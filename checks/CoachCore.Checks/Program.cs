using System.Text.Json;
using FitnessLifestyle.Coach;

var options = new JsonSerializerOptions(JsonSerializerDefaults.Web);
var json = File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "pose_fixtures.json"));
var fixtures = JsonSerializer.Deserialize<ReplayCase[]>(json, options)
    ?? throw new InvalidOperationException("Thiếu dữ liệu kiểm thử.");
foreach (var test in fixtures)
{
    var result = PoseReplay.Analyze(new(test.Exercise, test.Frames));
    Check(result.Summary.CompletedReps == test.ExpectedCompleted, $"{test.Id}: completed");
    Check(result.Summary.FormOkReps == test.ExpectedFormOk, $"{test.Id}: form");
    Check(result.Summary.PartialAttempts == test.ExpectedPartial, $"{test.Id}: partial");
    Check(result.Timeline.Count == test.Frames.Count, $"{test.Id}: one result per sample");
    Console.WriteLine($"PASS {test.Id}: {result.Summary.CompletedReps} rep hoàn tất, {result.Summary.FormOkReps} đạt luật form.");
}

static PosePoint At(double x, double y) => new(x / 1920, y / 1080, .95);
var angle = PoseReplay.JointAngle(At(500, 400), At(400, 400), At(500, 500), 1920, 1080);
Check(angle is double a && Math.Abs(a - 45) < 1e-6, "Ảnh 1920×1080 phải ra 45°.");
Check(PoseReplay.JointAngle(At(400, 400), At(400, 400), At(500, 500), 1920, 1080) is null,
    "Hai khớp trùng nhau không được xem là góc 0°.");
var first = fixtures[0].Frames[0] ?? throw new InvalidOperationException("Thiếu mẫu.");
Reject(new("squat", [first, first]), "Từ chối thứ tự trùng.");
Reject(new("squat", [first with { Width = 0 }]), "Từ chối ảnh rỗng.");
Reject(new("squat", [first with { Points = new() { ["left_hip"] = new(2, .5, .95) } }]),
    "Từ chối tọa độ ngoài phạm vi.");
Reject(new("plank", [first]), "Từ chối bài chưa có luật.");
var tracker = new PoseReplay.Tracker("squat");
var chunked = fixtures[0].Frames.Chunk(8).ToArray();
foreach (var batch in chunked) tracker.Append(batch, acceptRetries: true);
var prior = tracker.Latest;
var accepted = tracker.TotalFrames;
tracker.Append(chunked[^1], acceptRetries: true);
Check(tracker.TotalFrames == accepted && tracker.Latest == prior && prior?.CompletedReps == 2,
    "Retry does not advance the tracker or duplicate repetitions.");
var other = new PoseReplay.Tracker("squat");
try { other.Append([first, first]); throw new InvalidOperationException("Expected rejection"); }
catch (ArgumentException) { }
Check(other.TotalFrames == 0 && other.Latest is null, "Malformed batch is rejected atomically.");
Check(other.TrackedFrames == 0 && tracker.TrackedFrames > 0, "Tracker state is isolated.");
Console.WriteLine("PASS geometry and malformed-input checks.");

static void Check(bool ok, string description)
{
    if (!ok) throw new InvalidOperationException($"FAIL {description}");
}
static void Reject(PoseReplayRequest request, string description)
{
    try { PoseReplay.Analyze(request); }
    catch (ArgumentException) { return; }
    throw new InvalidOperationException($"FAIL {description}");
}

public sealed record ReplayCase(string Id, string Exercise, List<PoseFrame?> Frames,
    int ExpectedCompleted, int ExpectedFormOk, int ExpectedPartial);
