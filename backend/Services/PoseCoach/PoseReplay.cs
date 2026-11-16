namespace FitnessLifestyle.Coach;

// x/y in [0,1] in the same oriented camera image (after undoing model padding).
public sealed record PosePoint(double X, double Y, double Score);
public sealed record PoseFrame(
    int Sequence, long TimestampMs, int Width, int Height,
    Dictionary<string, PosePoint?>? Points);
public sealed record PoseReplayRequest(string? Exercise, List<PoseFrame?>? Frames);
public sealed record PoseStep(
    int Sequence, long TimestampMs, string Phase, bool Tracking,
    double? AngleDegrees, int CompletedReps, int FormOkReps,
    int PartialAttempts, string? FeedbackCode);
public sealed record PoseReplayResult(
    string Exercise, string EngineVersion, int TrackedFrames,
    PoseStep Summary, List<PoseStep> Timeline);

/// <summary>Deterministic replay of a single exercise. No SQL, camera or wall clock.</summary>
public static class PoseReplay
{
    public const string EngineVersion = "coach-csharp-02";
    public const int MaxFrames = 1200;

    public static PoseReplayResult Analyze(PoseReplayRequest? request)
    {
        if (request?.Frames is not { Count: > 0 and <= MaxFrames } frames)
            throw new ArgumentException($"Cần từ 1 đến {MaxFrames} mẫu điểm khớp.");
        var tracker = new Tracker(request.Exercise);
        var timeline = tracker.Append(frames).ToList();
        return new(tracker.Exercise, EngineVersion, tracker.TrackedFrames, timeline[^1], timeline);
    }

    public sealed class Tracker
    {
        private readonly Engine engine;
        private int lastSequence = -1;
        private long lastTimestamp = -1;
        public string Exercise { get; }
        public int TrackedFrames { get; private set; }
        public int TotalFrames { get; private set; }
        public long? FirstTimestampMs { get; private set; }
        public PoseStep? Latest { get; private set; }

        public Tracker(string? exercise)
        {
            var rule = exercise switch
            {
                "squat" => new Rule("squat", 155, 105, ["shoulder", "hip", "knee", "ankle"]),
                "pushup" => new Rule("pushup", 155, 105, ["shoulder", "elbow", "wrist", "hip", "ankle"]),
                _ => throw new ArgumentException("Bài tập phải là squat hoặc pushup.")
            };
            Exercise = rule.Id;
            engine = new Engine(rule);
        }

        public IReadOnlyList<PoseStep> Append(IReadOnlyList<PoseFrame?> samples, bool acceptRetries = false)
        {
            // Validate the entire batch before mutating the tracking state.
            var newFrames = new List<PoseFrame>(samples.Count);
            var previousSequence = -1;
            long previousTime = -1;
            foreach (var sample in samples)
            {
                if (sample is null || sample.Sequence <= previousSequence ||
                    sample.TimestampMs <= previousTime || sample.TimestampMs > 600_000 ||
                    sample.Width is < 1 or > 8192 || sample.Height is < 1 or > 8192 ||
                    sample.Points is null || sample.Points.Count > 40)
                    throw new ArgumentException("Kiểm tra thời điểm, thứ tự và kích thước mẫu.");
                foreach (var point in sample.Points.Values)
                {
                    if (point is null || !Unit(point.X) || !Unit(point.Y) || !Unit(point.Score))
                        throw new ArgumentException("Tọa độ và độ tin cậy phải thuộc [0, 1].");
                }
                previousSequence = sample.Sequence;
                previousTime = sample.TimestampMs;
                if (acceptRetries && sample.Sequence <= lastSequence) continue;
                if (sample.Sequence <= lastSequence || sample.TimestampMs <= lastTimestamp)
                    throw new ArgumentException("Mẫu mới phải có thứ tự và thời gian tăng dần.");
                newFrames.Add(sample);
            }

            var timeline = new List<PoseStep>(newFrames.Count);
            foreach (var sample in newFrames)
            {
                FirstTimestampMs ??= sample.TimestampMs;
                lastSequence = sample.Sequence;
                lastTimestamp = sample.TimestampMs;
                var step = engine.Step(sample);
                Latest = step;
                TotalFrames++;
                if (step.Tracking) TrackedFrames++;
                timeline.Add(step);
            }
            return timeline;
        }
    }

    private static bool Unit(double x) => double.IsFinite(x) && x is >= 0 and <= 1;

    private readonly record struct Pixel(double X, double Y);
    private sealed record Rule(string Id, double Up, double Down, string[] Joints);

    /// <summary>Angle in degrees in image pixels. Null indicates a degenerate segment.</summary>
    public static double? JointAngle(PosePoint a, PosePoint b, PosePoint c, int width, int height) =>
        Angle(new(a.X * width, a.Y * height), new(b.X * width, b.Y * height),
              new(c.X * width, c.Y * height));

    private static double? Angle(Pixel a, Pixel b, Pixel c)
    {
        double ux = a.X - b.X, uy = a.Y - b.Y, vx = c.X - b.X, vy = c.Y - b.Y;
        var size = Math.Sqrt(ux * ux + uy * uy) * Math.Sqrt(vx * vx + vy * vy);
        if (size < 1e-6) return null;
        return Math.Acos(Math.Clamp((ux * vx + uy * vy) / size, -1, 1)) * 180 / Math.PI;
    }

    private sealed class Engine(Rule rule)
    {
        // Prototype parameters. Calibrate on labelled clips before using for form feedback.
        private const double MinConfidence = 0.4;
        private const long MaxGapMs = 700;
        private const long StableMs = 100;
        private const long MaxRepMs = 12_000;
        private const double FilterTimeMs = 55;
        private enum Phase { Waiting, Ready, Descending, Depth }
        private Phase phase;
        private string? side;
        private readonly Dictionary<string, Pixel> smooth = new();
        private long? lastTracked;
        private long? candidateSince;
        private long? formIssueSince;
        private long repStarted;
        private int width, height;
        private int completed, good, partial;
        private bool formIssue;

        public PoseStep Step(PoseFrame frame)
        {
            var now = frame.TimestampMs;
            if (width != frame.Width || height != frame.Height ||
                (lastTracked is long previous && now - previous > MaxGapMs))
                ResetTracking();

            width = frame.Width;
            height = frame.Height;
            var points = frame.Points!;
            var currentSide = side ?? SelectSide(points);
            if (currentSide is null || SideConfidence(points, currentSide) < MinConfidence)
                return Missing(frame);

            side = currentSide; // Keep the same side throughout tracking; don't mix left/right joints.
            var alpha = lastTracked is long t ? 1 - Math.Exp(-(now - t) / FilterTimeMs) : 1;
            foreach (var joint in rule.Joints)
            {
                var point = points[$"{side}_{joint}"]!;
                var pixel = new Pixel(point.X * frame.Width, point.Y * frame.Height);
                if (smooth.TryGetValue(joint, out var last))
                    pixel = new(last.X + alpha * (pixel.X - last.X), last.Y + alpha * (pixel.Y - last.Y));
                smooth[joint] = pixel;
            }

            var angle = rule.Id == "squat"
                ? Angle(smooth["hip"], smooth["knee"], smooth["ankle"])
                : Angle(smooth["shoulder"], smooth["elbow"], smooth["wrist"]);
            var alignment = rule.Id == "squat"
                ? Angle(smooth["shoulder"], smooth["hip"], new(smooth["hip"].X, smooth["hip"].Y - 1))
                : Angle(smooth["shoulder"], smooth["hip"], smooth["ankle"]);
            if (angle is not double jointAngle || alignment is not double bodyAngle)
                return Missing(frame);
            lastTracked = now;
            if ((phase is Phase.Descending or Phase.Depth) && now - repStarted > MaxRepMs)
                ResetCycle();

            var badAlignment = rule.Id == "squat" ? bodyAngle > 55 : bodyAngle < 150;
            string? feedback = null;
            if (phase is Phase.Descending or Phase.Depth)
            {
                if (badAlignment)
                {
                    formIssueSince ??= now;
                    if (now - formIssueSince.Value >= StableMs) formIssue = true;
                }
                else formIssueSince = null;
                if (formIssue) feedback = "review_alignment";
            }

            switch (phase)
            {
                case Phase.Waiting:
                    if (Stable(jointAngle >= rule.Up, now)) SetPhase(Phase.Ready);
                    break;
                case Phase.Ready:
                    if (jointAngle < rule.Up - 12)
                    {
                        repStarted = now;
                        formIssue = false;
                        formIssueSince = badAlignment ? now : null;
                        SetPhase(Phase.Descending);
                    }
                    break;
                case Phase.Descending:
                    if (jointAngle <= rule.Down)
                    {
                        if (topCandidate) ClearCandidate();
                        if (Stable(true, now)) SetPhase(Phase.Depth);
                    }
                    else if (jointAngle >= rule.Up)
                    {
                        // A separate candidate is needed when switching from depth to top.
                        if (StableTop(now))
                        {
                            partial++;
                            feedback = "incomplete_range";
                            SetPhase(Phase.Ready);
                        }
                    }
                    else ClearCandidate();
                    break;
                case Phase.Depth:
                    if (Stable(jointAngle >= rule.Up, now))
                    {
                        completed++;
                        if (!formIssue) good++;
                        feedback = formIssue ? "review_alignment" : "rep_complete";
                        SetPhase(Phase.Ready);
                    }
                    break;
            }
            return Result(frame, true, jointAngle, feedback);
        }

        private bool topCandidate;
        private bool StableTop(long now)
        {
            if (!topCandidate) { candidateSince = null; topCandidate = true; }
            return Stable(true, now);
        }

        private bool Stable(bool condition, long now)
        {
            if (!condition) { ClearCandidate(); return false; }
            candidateSince ??= now;
            return now - candidateSince.Value >= StableMs;
        }

        private void ClearCandidate() { candidateSince = null; topCandidate = false; }
        private void SetPhase(Phase value) { phase = value; ClearCandidate(); }
        private void ResetCycle()
        {
            SetPhase(Phase.Waiting);
            formIssue = false;
            formIssueSince = null;
        }
        private void ResetTracking()
        {
            ResetCycle();
            side = null;
            lastTracked = null;
            smooth.Clear();
        }

        private PoseStep Missing(PoseFrame frame)
        {
            ClearCandidate();
            formIssueSince = null;
            smooth.Clear(); // Don't smooth stale coordinates into the next observed pose.
            return Result(frame, false, null, "tracking_lost");
        }

        private string? SelectSide(Dictionary<string, PosePoint?> points)
        {
            var left = SideConfidence(points, "left");
            var right = SideConfidence(points, "right");
            return Math.Max(left, right) < MinConfidence ? null : left >= right ? "left" : "right";
        }

        private double SideConfidence(Dictionary<string, PosePoint?> points, string sideName) =>
            rule.Joints.Min(j => points.TryGetValue($"{sideName}_{j}", out var p) ? p?.Score ?? 0 : 0);

        private PoseStep Result(PoseFrame f, bool tracking, double? angle, string? feedback) =>
            new(f.Sequence, f.TimestampMs,
                tracking ? phase.ToString().ToLowerInvariant() : "lost", tracking,
                angle is double a ? Math.Round(a, 1) : null, completed, good, partial, feedback);
    }
}
