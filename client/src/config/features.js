/**
 * Feature flags for work that ships behind a "Coming soon" state.
 *
 * The Live Practice Room (1:1 WebRTC mock interviews, scheduling, TURN relay)
 * is code-complete and everything short of real camera hardware has been
 * verified directly: signaling protocol, TURN server reachability, ICE
 * credential handoff, join-window enforcement, .ics invites, and the reminder
 * queue. What hasn't been proven yet is an actual two-browser video/audio
 * connection. Flip back to false if that test fails.
 */
export const LIVE_PRACTICE_ROOM_ENABLED = true;
