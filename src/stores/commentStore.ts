import { create } from 'zustand';
import { supabase } from '@/src/services/supabase';
import { RecipeCommentWithProfile } from '@/src/types/database';
import { RealtimeChannel } from '@supabase/supabase-js';

interface CommentState {
  comments: RecipeCommentWithProfile[];
  isLoading: boolean;
  unreadCounts: Record<string, number>; // recipeId -> count
  activeRecipeId: string | null;
  _channel: RealtimeChannel | null;

  fetchComments: (recipeId: string) => Promise<void>;
  addComment: (
    recipeId: string,
    content: string,
    parentCommentId?: string
  ) => Promise<RecipeCommentWithProfile | null>;
  updateComment: (commentId: string, content: string) => Promise<void>;
  deleteComment: (commentId: string) => Promise<void>;
  subscribeToComments: (recipeId: string) => void;
  unsubscribeFromComments: () => void;
  resetUnreadCount: (recipeId: string) => void;
}

export const useCommentStore = create<CommentState>()((set, get) => ({
  comments: [],
  isLoading: false,
  unreadCounts: {},
  activeRecipeId: null,
  _channel: null,

  fetchComments: async (recipeId) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase
        .from('recipe_comments')
        .select('*, profiles:user_id(full_name, avatar_url)')
        .eq('recipe_id', recipeId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Organize into threads: top-level + replies
      const allComments = (data || []) as RecipeCommentWithProfile[];
      const topLevel = allComments.filter((c) => !c.parent_comment_id);
      const replies = allComments.filter((c) => c.parent_comment_id);

      const threaded = topLevel.map((comment) => ({
        ...comment,
        replies: replies.filter((r) => r.parent_comment_id === comment.id),
      }));

      set({ comments: threaded });
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  addComment: async (recipeId, content, parentCommentId) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('recipe_comments')
        .insert({
          recipe_id: recipeId,
          user_id: user.id,
          content,
          parent_comment_id: parentCommentId || null,
        })
        .select('*, profiles:user_id(full_name, avatar_url)')
        .single();

      if (error) throw error;

      const newComment = data as RecipeCommentWithProfile;

      // Add to local state
      set((state) => {
        if (parentCommentId) {
          // Add as reply
          return {
            comments: state.comments.map((c) =>
              c.id === parentCommentId
                ? { ...c, replies: [...(c.replies || []), newComment] }
                : c
            ),
          };
        }
        // Add as top-level
        return {
          comments: [...state.comments, { ...newComment, replies: [] }],
        };
      });

      return newComment;
    } catch (error) {
      console.error('Failed to add comment:', error);
      return null;
    }
  },

  updateComment: async (commentId, content) => {
    try {
      const { error } = await supabase
        .from('recipe_comments')
        .update({ content })
        .eq('id', commentId);

      if (error) throw error;

      set((state) => ({
        comments: state.comments.map((c) => {
          if (c.id === commentId) return { ...c, content };
          if (c.replies) {
            return {
              ...c,
              replies: c.replies.map((r) =>
                r.id === commentId ? { ...r, content } : r
              ),
            };
          }
          return c;
        }),
      }));
    } catch (error) {
      console.error('Failed to update comment:', error);
    }
  },

  deleteComment: async (commentId) => {
    try {
      const { error } = await supabase
        .from('recipe_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;

      set((state) => ({
        comments: state.comments
          .filter((c) => c.id !== commentId)
          .map((c) => ({
            ...c,
            replies: c.replies?.filter((r) => r.id !== commentId),
          })),
      }));
    } catch (error) {
      console.error('Failed to delete comment:', error);
    }
  },

  subscribeToComments: (recipeId) => {
    // Unsubscribe from any existing channel first
    get().unsubscribeFromComments();

    const channel = supabase
      .channel(`recipe-comments-${recipeId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'recipe_comments',
          filter: `recipe_id=eq.${recipeId}`,
        },
        async (payload) => {
          const newComment = payload.new as any;

          // Check if this comment was already added by us (optimistic update)
          const existing = get().comments.find((c) => c.id === newComment.id) ||
            get().comments.some((c) => c.replies?.some((r) => r.id === newComment.id));
          if (existing) return;

          // Fetch the comment with profile info
          const { data } = await supabase
            .from('recipe_comments')
            .select('*, profiles:user_id(full_name, avatar_url)')
            .eq('id', newComment.id)
            .single();

          if (!data) return;

          const commentWithProfile = data as RecipeCommentWithProfile;

          set((state) => {
            if (commentWithProfile.parent_comment_id) {
              return {
                comments: state.comments.map((c) =>
                  c.id === commentWithProfile.parent_comment_id
                    ? {
                        ...c,
                        replies: [...(c.replies || []), commentWithProfile],
                      }
                    : c
                ),
              };
            }
            return {
              comments: [
                ...state.comments,
                { ...commentWithProfile, replies: [] },
              ],
            };
          });

          // Increment unread count if Discussion tab is not active
          const { activeRecipeId } = get();
          if (activeRecipeId !== recipeId) {
            set((state) => ({
              unreadCounts: {
                ...state.unreadCounts,
                [recipeId]: (state.unreadCounts[recipeId] || 0) + 1,
              },
            }));
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'recipe_comments',
          filter: `recipe_id=eq.${recipeId}`,
        },
        (payload) => {
          const deletedId = payload.old.id;
          set((state) => ({
            comments: state.comments
              .filter((c) => c.id !== deletedId)
              .map((c) => ({
                ...c,
                replies: c.replies?.filter((r) => r.id !== deletedId),
              })),
          }));
        }
      )
      .subscribe();

    set({ _channel: channel, activeRecipeId: recipeId });
  },

  unsubscribeFromComments: () => {
    const channel = get()._channel;
    if (channel) {
      supabase.removeChannel(channel);
      set({ _channel: null, activeRecipeId: null });
    }
  },

  resetUnreadCount: (recipeId) => {
    set((state) => ({
      unreadCounts: { ...state.unreadCounts, [recipeId]: 0 },
      activeRecipeId: recipeId,
    }));
  },
}));
