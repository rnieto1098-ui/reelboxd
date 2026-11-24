// Film-themed profile pictures (public/avatars, generated with Higgsfield).
// Someone without a photo gets one picked from their username, so the same
// person always has the same picture; they can also choose one in Settings,
// which stores its path in User.image like an uploaded photo's URL.

export type AvatarPreset = { id: string; name: string; src: string };

function preset(id: string, name: string): AvatarPreset {
  return { id, name, src: `/avatars/${id}.webp` };
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  preset("projector", "Projector"),
  preset("clapperboard", "Clapperboard"),
  preset("popcorn", "Popcorn"),
  preset("film-reel", "Film reel"),
  preset("directors-chair", "Director's chair"),
  preset("3d-glasses", "3D glasses"),
  preset("ticket", "Ticket"),
  preset("camera", "Camera"),
];

export function avatarPresetById(id: string): AvatarPreset | undefined {
  return AVATAR_PRESETS.find((p) => p.id === id);
}

/** True when a stored User.image is one of the presets rather than an upload. */
export function isPresetAvatar(image: string | null | undefined): boolean {
  return !!image && AVATAR_PRESETS.some((p) => p.src === image);
}

/** A stable preset for someone with no picture: the same username always gets the same one. */
export function defaultAvatar(username: string): AvatarPreset {
  let hash = 0;
  for (const ch of username.toLowerCase()) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_PRESETS[hash % AVATAR_PRESETS.length];
}

/** What to show for a user: their photo or chosen preset, else their default preset. */
export function avatarSrc(image: string | null | undefined, username: string): string {
  return image || defaultAvatar(username).src;
}
