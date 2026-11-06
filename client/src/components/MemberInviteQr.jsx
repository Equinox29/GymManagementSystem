import { useMemo } from 'react';
import { createMemberInviteQr, memberInvitePayload } from '../utils/memberInviteQr';

export default function MemberInviteQr({ email, inviteCode }) {
  const matrix = useMemo(() => createMemberInviteQr(memberInvitePayload(email, inviteCode)), [email, inviteCode]);
  const path = matrix.flatMap((row, y) => row.flatMap((dark, x) => dark ? [`M${x + 4},${y + 4}h1v1h-1z`] : [])).join('');

  return (
    <svg role="img" aria-label={`Member invitation QR code for ${email}`} viewBox="0 0 45 45" className="member-invite-qr">
      <rect width="45" height="45" fill="white" />
      <path d={path} fill="#090909" />
    </svg>
  );
}
