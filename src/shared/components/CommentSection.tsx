import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCommentStore } from '@/src/stores/commentStore';
import { useUserStore } from '@/src/stores';
import { RecipeCommentWithProfile } from '@/src/types/database';

interface CommentSectionProps {
  recipeId: string;
}

function getInitials(name: string | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function timeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function Avatar({ name }: { name: string | null }) {
  return (
    <View
      style={{
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#E8EDE4',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: 13, fontWeight: '600', color: '#6B7F5E' }}>
        {getInitials(name)}
      </Text>
    </View>
  );
}

function CommentItem({
  comment,
  currentUserId,
  onReply,
  onDelete,
  isReply = false,
}: {
  comment: RecipeCommentWithProfile;
  currentUserId: string | undefined;
  onReply: (commentId: string, authorName: string) => void;
  onDelete: (commentId: string) => void;
  isReply?: boolean;
}) {
  const [showAllReplies, setShowAllReplies] = useState(false);
  const authorName = comment.profiles?.full_name || 'Anonymous';
  const replies = comment.replies || [];
  const visibleReplies = showAllReplies ? replies : replies.slice(0, 3);
  const hiddenCount = replies.length - 3;

  return (
    <View style={{ marginBottom: isReply ? 8 : 16 }}>
      <View
        style={{
          flexDirection: 'row',
          gap: 10,
          marginLeft: isReply ? 46 : 0,
        }}
      >
        <Avatar name={authorName} />
        <View style={{ flex: 1 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              marginBottom: 4,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#1F2937' }}>
              {authorName}
            </Text>
            <Text style={{ fontSize: 12, color: '#9CA3AF' }}>
              {timeAgo(comment.created_at)}
            </Text>
          </View>
          <Text style={{ fontSize: 15, color: '#374151', lineHeight: 22 }}>
            {comment.content}
          </Text>
          <View style={{ flexDirection: 'row', gap: 16, marginTop: 6 }}>
            {!isReply && (
              <TouchableOpacity
                onPress={() => onReply(comment.id, authorName)}
                accessibilityLabel={`Reply to ${authorName}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              >
                <Ionicons name="return-down-forward-outline" size={14} color="#9CA3AF" />
                <Text style={{ fontSize: 13, color: '#9CA3AF' }}>Reply</Text>
              </TouchableOpacity>
            )}
            {comment.user_id === currentUserId && (
              <TouchableOpacity
                onPress={() => onDelete(comment.id)}
                accessibilityLabel="Delete comment"
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              >
                <Ionicons name="trash-outline" size={14} color="#EF4444" />
                <Text style={{ fontSize: 13, color: '#EF4444' }}>Delete</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Replies */}
      {!isReply && visibleReplies.length > 0 && (
        <View style={{ marginTop: 8 }}>
          {visibleReplies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              currentUserId={currentUserId}
              onReply={onReply}
              onDelete={onDelete}
              isReply
            />
          ))}
          {!showAllReplies && hiddenCount > 0 && (
            <TouchableOpacity
              onPress={() => setShowAllReplies(true)}
              style={{ marginLeft: 46, marginTop: 4 }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#6B7F5E' }}>
                Load {hiddenCount} more {hiddenCount === 1 ? 'reply' : 'replies'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

export function CommentSection({ recipeId }: CommentSectionProps) {
  const {
    comments,
    isLoading,
    fetchComments,
    addComment,
    deleteComment,
    subscribeToComments,
    unsubscribeFromComments,
    resetUnreadCount,
  } = useCommentStore();
  const user = useUserStore((s) => s.user);
  const profile = useUserStore((s) => s.profile);

  const [inputText, setInputText] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [isSending, setIsSending] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    fetchComments(recipeId);
    subscribeToComments(recipeId);
    resetUnreadCount(recipeId);

    return () => {
      unsubscribeFromComments();
    };
  }, [recipeId]);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text) return;

    setIsSending(true);
    await addComment(recipeId, text, replyTo?.id);
    setInputText('');
    setReplyTo(null);
    setIsSending(false);
  };

  const handleReply = (commentId: string, authorName: string) => {
    setReplyTo({ id: commentId, name: authorName });
    inputRef.current?.focus();
  };

  const handleDelete = (commentId: string) => {
    deleteComment(commentId);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={120}
      style={{ flex: 1 }}
    >
      <View style={{ flex: 1 }}>
        {/* Comments List */}
        {isLoading && comments.length === 0 ? (
          <View
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 40,
            }}
          >
            <ActivityIndicator color="#6B7F5E" />
          </View>
        ) : comments.length === 0 ? (
          <View
            style={{
              alignItems: 'center',
              paddingVertical: 40,
              paddingHorizontal: 20,
            }}
          >
            <Ionicons name="chatbubble-outline" size={36} color="#D1D5DB" />
            <Text
              style={{
                fontSize: 15,
                color: '#9CA3AF',
                textAlign: 'center',
                marginTop: 10,
                lineHeight: 22,
              }}
            >
              No comments yet.{'\n'}Be the first to share your thoughts!
            </Text>
          </View>
        ) : (
          <View style={{ paddingBottom: 8 }}>
            {comments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                currentUserId={user?.id}
                onReply={handleReply}
                onDelete={handleDelete}
              />
            ))}
          </View>
        )}

        {/* Reply Indicator */}
        {replyTo && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#E8EDE4',
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 8,
              marginBottom: 8,
            }}
          >
            <Text style={{ flex: 1, fontSize: 13, color: '#6B7F5E' }}>
              Replying to {replyTo.name}
            </Text>
            <TouchableOpacity onPress={() => setReplyTo(null)}>
              <Ionicons name="close-circle" size={20} color="#6B7F5E" />
            </TouchableOpacity>
          </View>
        )}

        {/* Input Bar */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: 10,
            paddingTop: 8,
            borderTopWidth: 1,
            borderTopColor: '#F3F4F6',
          }}
        >
          <Avatar name={profile?.full_name || null} />
          <TextInput
            ref={inputRef}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Add a comment..."
            placeholderTextColor="#9CA3AF"
            multiline
            maxLength={2000}
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: '#E5E7EB',
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 10,
              fontSize: 15,
              color: '#1F2937',
              maxHeight: 100,
            }}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!inputText.trim() || isSending}
            accessibilityLabel="Send comment"
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor:
                inputText.trim() && !isSending ? '#6B7F5E' : '#E5E7EB',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 2,
            }}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons
                name="send"
                size={18}
                color={inputText.trim() ? '#FFFFFF' : '#9CA3AF'}
              />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
