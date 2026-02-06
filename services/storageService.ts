
import { supabase } from '../lib/supabase';

export const storageService = {
    async uploadAthletePhoto(file: File, athleteId: string): Promise<string> {
        const fileExt = file.name.split('.').pop();
        const fileName = `${athleteId}-${Date.now()}.${fileExt}`;
        const filePath = `athletes/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('athlete-photos')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: true,
            });

        if (uploadError) {
            throw uploadError;
        }

        const { data } = supabase.storage
            .from('athlete-photos')
            .getPublicUrl(filePath);

        return data.publicUrl;
    },

    async deleteAthletePhoto(photoUrl: string): Promise<void> {
        // Extract file path from URL
        const urlParts = photoUrl.split('/athlete-photos/');
        if (urlParts.length < 2) return;

        const filePath = urlParts[1];

        const { error } = await supabase.storage
            .from('athlete-photos')
            .remove([filePath]);

        if (error) {
            console.error('Error deleting photo:', error);
        }
    },
};
