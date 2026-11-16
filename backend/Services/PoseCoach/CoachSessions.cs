namespace FitnessLifestyle.Coach;

public sealed class CoachSessions
{
    private readonly Dictionary<Guid, Session> sessions = new();
    private readonly object gate = new();
    private static readonly TimeSpan Retention = TimeSpan.FromMinutes(15);

    public Session? Open(int userId, int exerciseId, string exercise)
    {
        lock (gate)
        {
            Prune();
            if (sessions.Count >= 128 ||
                sessions.Values.Count(s => s.UserId == userId && s.Saved is null && !s.Cancelled) >= 3)
                return null;
            var session = new Session(Guid.NewGuid(), userId, exerciseId, new PoseReplay.Tracker(exercise));
            sessions.Add(session.Id, session);
            return session;
        }
    }

    public Session? Get(Guid id, int userId)
    {
        lock (gate)
        {
            Prune();
            if (!sessions.TryGetValue(id, out var session) || session.UserId != userId) return null;
            session.Touch();
            return session;
        }
    }

    private void Prune()
    {
        var cutoff = DateTime.UtcNow.Subtract(Retention).Ticks;
        foreach (var id in sessions.Where(pair => pair.Value.LastSeen < cutoff).Select(pair => pair.Key).ToList())
            sessions.Remove(id);
    }

    public sealed class Session(Guid id, int userId, int exerciseId, PoseReplay.Tracker tracker)
    {
        private long lastSeen = DateTime.UtcNow.Ticks;
        public Guid Id { get; } = id;
        public int UserId { get; } = userId;
        public int ExerciseId { get; } = exerciseId;
        public PoseReplay.Tracker Tracker { get; } = tracker;
        public SemaphoreSlim Lock { get; } = new(1, 1);
        public bool Cancelled { get; set; }
        public SavedWorkout? Saved { get; set; }
        public long LastSeen => Interlocked.Read(ref lastSeen);
        public void Touch() => Interlocked.Exchange(ref lastSeen, DateTime.UtcNow.Ticks);
    }

    public sealed record SavedWorkout(int WorkoutId, int AnalysisId, PoseStep Result, double DurationSeconds);
}
