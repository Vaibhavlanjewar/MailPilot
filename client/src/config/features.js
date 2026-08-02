/**
 * Feature flags for work that ships behind a "Coming soon" state.
 *
 * The Live Practice Room (1:1 WebRTC mock interviews) is code-complete and its
 * signaling protocol is verified end-to-end, but the actual peer-to-peer media
 * path hasn't been confirmed on real hardware yet, and there's no TURN server —
 * so calls can still fail on strict corporate/campus networks. Flip this to
 * true (single line, no other changes) once a real two-browser call is verified.
 */
export const LIVE_PRACTICE_ROOM_ENABLED = false;
