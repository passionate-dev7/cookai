import { create } from 'zustand';
import { supabase } from '@/src/services/supabase';
import { uploadPhotos, deletePhoto } from '@/src/services/storage';
import { CookingLogWithPhotos } from '@/src/types/database';

interface CookingLogState {
  logs: CookingLogWithPhotos[];
  isLoading: boolean;

  fetchLogs: (recipeId: string) => Promise<void>;
  createCookingLog: (
    recipeId: string,
    photoUris: string[],
    notes?: string
  ) => Promise<CookingLogWithPhotos | null>;
  deleteCookingLog: (logId: string) => Promise<void>;
}

export const useCookingLogStore = create<CookingLogState>()((set, get) => ({
  logs: [],
  isLoading: false,

  fetchLogs: async (recipeId) => {
    set({ isLoading: true });
    try {
      const { data: logs, error } = await supabase
        .from('cooking_logs')
        .select('*')
        .eq('recipe_id', recipeId)
        .order('cooked_at', { ascending: false });

      if (error) throw error;

      // Fetch photos for each log
      const logIds = (logs || []).map((l) => l.id);
      let photos: any[] = [];
      if (logIds.length > 0) {
        const { data: photoData, error: photoError } = await supabase
          .from('cooking_log_photos')
          .select('*')
          .in('cooking_log_id', logIds)
          .order('order_index', { ascending: true });

        if (photoError) throw photoError;
        photos = photoData || [];
      }

      // Group photos by cooking_log_id
      const logsWithPhotos: CookingLogWithPhotos[] = (logs || []).map((log) => ({
        ...log,
        photos: photos.filter((p) => p.cooking_log_id === log.id),
      }));

      set({ logs: logsWithPhotos });
    } catch (error) {
      console.error('Failed to fetch cooking logs:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  createCookingLog: async (recipeId, photoUris, notes) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      // Create the cooking log
      const { data: log, error: logError } = await supabase
        .from('cooking_logs')
        .insert({
          user_id: user.id,
          recipe_id: recipeId,
          cooked_at: new Date().toISOString(),
          notes: notes || null,
        })
        .select()
        .single();

      if (logError) throw logError;

      let photos: any[] = [];

      // Upload photos if provided
      if (photoUris.length > 0) {
        const urls = await uploadPhotos(photoUris, user.id);

        if (urls.length > 0) {
          const photoInserts = urls.map((url, index) => ({
            cooking_log_id: log.id,
            photo_url: url,
            order_index: index,
          }));

          const { data: photoData, error: photoError } = await supabase
            .from('cooking_log_photos')
            .insert(photoInserts)
            .select();

          if (photoError) throw photoError;
          photos = photoData || [];
        }
      }

      const logWithPhotos: CookingLogWithPhotos = {
        ...log,
        photos,
      };

      set((state) => ({ logs: [logWithPhotos, ...state.logs] }));
      return logWithPhotos;
    } catch (error) {
      console.error('Failed to create cooking log:', error);
      return null;
    }
  },

  deleteCookingLog: async (logId) => {
    try {
      const log = get().logs.find((l) => l.id === logId);
      if (!log) return;

      // Delete photos from storage
      for (const photo of log.photos) {
        await deletePhoto(photo.photo_url);
      }

      // Delete log (cascade deletes photos from DB)
      const { error } = await supabase
        .from('cooking_logs')
        .delete()
        .eq('id', logId);

      if (error) throw error;

      set((state) => ({
        logs: state.logs.filter((l) => l.id !== logId),
      }));
    } catch (error) {
      console.error('Failed to delete cooking log:', error);
    }
  },
}));
