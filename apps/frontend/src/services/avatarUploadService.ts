// Avatar Upload Service
// Uploads avatar images directly to Supabase Storage from the frontend
// and returns the public URL of the uploaded file.

import { supabase } from './supabaseClient';

const AVATAR_BUCKET = 'avatars';

/**
 * Uploads a file to the Supabase 'avatars' bucket under a path scoped to the
 * given userId. Re-uploads overwrite the previous file at the same path.
 *
 * @param file   - The image File object selected by the user.
 * @param userId - The authenticated user's ID (used as the storage path prefix).
 * @returns      The public URL of the uploaded avatar.
 * @throws       An Error with a human-readable message on failure.
 */
export async function uploadAvatarToSupabase(file: File, userId: string): Promise<string> {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const storagePath = `${userId}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(storagePath, file, {
            contentType: file.type,
            upsert: true,
        });

    if (uploadError) {
        throw new Error(`Avatar upload failed: ${uploadError.message}`);
    }

    const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(storagePath);

    if (!data?.publicUrl) {
        throw new Error('Could not retrieve public URL for uploaded avatar.');
    }

    return data.publicUrl;
}
