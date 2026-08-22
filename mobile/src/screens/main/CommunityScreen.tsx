import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import api from '../../services/api';
import { Screen, Card, Field, PrimaryButton, SecondaryButton } from '../../components/ui';
import { colors } from '../../theme/colors';

const CATEGORIES = ['Interview Experience', 'Referrals', 'Resume Review', 'Salary', 'General'];
const TOXIC_TOKENS = [
  'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'cunt', 'dick', 'idiot', 'stupid', 'dumbass',
  'scam', 'crypto rich', 'make fast money', 'buy bitcoin', 'hack account', 'kill yourself',
  'threaten', 'harass', 'hate speech',
];

function checkContent(text: string) {
  const lower = (text || '').toLowerCase();
  for (const token of TOXIC_TOKENS) {
    if (lower.includes(token)) return `Blocked word detected: "${token}"`;
  }
  if (/(.)\1{7,}/.test(lower)) return 'Suspicious spam pattern.';
  return null;
}

function timeAgo(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

type Post = {
  _id: string;
  title: string;
  body: string;
  category: string;
  authorName?: string;
  createdAt: string;
  upvoteCount: number;
  replyCount: number;
  hasUpvoted: boolean;
  isOwner: boolean;
};

export default function CommunityScreen() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [postCategory, setPostCategory] = useState('General');
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);

  const [expanded, setExpanded] = useState<{ post: any } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/discussions', {
        params: { category: category === 'All' ? undefined : category, q: search.trim() || undefined },
      });
      setPosts(data.posts || []);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.message || 'Could not load discussions.' });
    } finally {
      setLoading(false);
    }
  }, [category, search]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  async function handleCreate() {
    const titleError = checkContent(title);
    const bodyError = checkContent(body);
    if (titleError) return Toast.show({ type: 'error', text1: titleError });
    if (bodyError) return Toast.show({ type: 'error', text1: bodyError });
    if (!title.trim() || !body.trim()) return Toast.show({ type: 'info', text1: 'Title and body are required.' });

    setPosting(true);
    try {
      const { data } = await api.post('/discussions', { title: title.trim(), body: body.trim(), category: postCategory });
      setPosts((prev) => [{ ...data.post, upvoteCount: 0, replyCount: 0, hasUpvoted: false, isOwner: true }, ...prev]);
      setTitle('');
      setBody('');
      setPostCategory('General');
      setComposerOpen(false);
      Toast.show({ type: 'success', text1: 'Posted to the community.' });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.message || 'Could not publish your post.' });
    } finally {
      setPosting(false);
    }
  }

  function confirmDeletePost(post: Post) {
    Alert.alert('Delete this post?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/discussions/${post._id}`);
            setPosts((prev) => prev.filter((p) => p._id !== post._id));
          } catch (err: any) {
            Toast.show({ type: 'error', text1: err?.message || 'Could not delete post.' });
          }
        },
      },
    ]);
  }

  async function toggleUpvote(post: Post) {
    setPosts((prev) =>
      prev.map((p) =>
        p._id === post._id ? { ...p, hasUpvoted: !p.hasUpvoted, upvoteCount: p.upvoteCount + (p.hasUpvoted ? -1 : 1) } : p
      )
    );
    try {
      await api.post(`/discussions/${post._id}/upvote`);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.message || 'Could not update like.' });
      load();
    }
  }

  async function toggleExpand(postId: string) {
    if (expandedId === postId) {
      setExpandedId(null);
      setExpanded(null);
      return;
    }
    setExpandedId(postId);
    try {
      const { data } = await api.get(`/discussions/${postId}`);
      setExpanded({ post: data.post });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.message || 'Could not load replies.' });
    }
  }

  async function postReply(postId: string) {
    const text = replyText.trim();
    if (!text) return;
    const error = checkContent(text);
    if (error) return Toast.show({ type: 'error', text1: error });
    try {
      const { data } = await api.post(`/discussions/${postId}/replies`, { body: text });
      setExpanded({ post: data.post });
      setReplyText('');
      setPosts((prev) => prev.map((p) => (p._id === postId ? { ...p, replyCount: p.replyCount + 1 } : p)));
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.message || 'Could not post reply.' });
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.chipRow}>
          {['All', ...CATEGORIES].map((c) => (
            <Pressable key={c} onPress={() => setCategory(c)} style={[styles.chip, category === c ? styles.chipActive : null]}>
              <Text style={[styles.chipText, category === c ? styles.chipTextActive : null]}>{c}</Text>
            </Pressable>
          ))}
        </View>
        <Field label="Search" placeholder="Search discussions…" value={search} onChangeText={setSearch} />
        <PrimaryButton title="+ Start a discussion" onPress={() => setComposerOpen(true)} />
      </View>

      {loading && posts.length === 0 ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: 40 }}
          onRefresh={load}
          refreshing={loading}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No discussions yet. Be the first to post.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Card style={{ marginBottom: 12 }}>
              <View style={styles.postHeader}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{(item.authorName || 'U').slice(0, 2).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.authorName}>{item.authorName || 'Member'}</Text>
                  <Text style={styles.muted}>{timeAgo(item.createdAt)}</Text>
                </View>
                <Text style={styles.categoryBadge}>{item.category}</Text>
                {item.isOwner ? (
                  <Pressable onPress={() => confirmDeletePost(item)} hitSlop={8} style={{ marginLeft: 8 }}>
                    <Ionicons name="trash-outline" size={16} color={colors.danger} />
                  </Pressable>
                ) : null}
              </View>

              <Text style={styles.postTitle}>{item.title}</Text>
              <Text style={styles.postBody}>{item.body}</Text>

              <View style={styles.actionRow}>
                <Pressable onPress={() => toggleUpvote(item)} style={styles.actionButton}>
                  <Ionicons name={item.hasUpvoted ? 'heart' : 'heart-outline'} size={16} color={item.hasUpvoted ? colors.danger : colors.textSecondary} />
                  <Text style={styles.actionText}>{item.upvoteCount}</Text>
                </Pressable>
                <Pressable onPress={() => toggleExpand(item._id)} style={styles.actionButton}>
                  <Ionicons name="chatbubble-outline" size={16} color={colors.textSecondary} />
                  <Text style={styles.actionText}>{item.replyCount}</Text>
                </Pressable>
              </View>

              {expandedId === item._id && expanded ? (
                <View style={styles.repliesBox}>
                  {(expanded.post.replies || []).map((r: any) => (
                    <View key={r._id} style={styles.replyRow}>
                      <Text style={styles.replyAuthor}>{r.authorName} · {timeAgo(r.createdAt)}</Text>
                      <Text style={styles.replyBody}>{r.body}</Text>
                    </View>
                  ))}
                  <View style={styles.replyInputRow}>
                    <TextInput
                      value={replyText}
                      onChangeText={setReplyText}
                      placeholder="Write a reply…"
                      placeholderTextColor={colors.textSecondary}
                      style={styles.replyInput}
                    />
                    <Pressable onPress={() => postReply(item._id)} style={styles.replySend}>
                      <Text style={styles.replySendText}>Reply</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </Card>
          )}
        />
      )}

      <Modal visible={composerOpen} transparent animationType="fade" onRequestClose={() => setComposerOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Start a discussion</Text>
            <Field label="Title" value={title} onChangeText={setTitle} />
            <Text style={styles.fieldLabel}>Category</Text>
            <View style={styles.chipRow}>
              {CATEGORIES.map((c) => (
                <Pressable key={c} onPress={() => setPostCategory(c)} style={[styles.chip, postCategory === c ? styles.chipActive : null]}>
                  <Text style={[styles.chipText, postCategory === c ? styles.chipTextActive : null]}>{c}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.fieldLabel}>Body</Text>
            <TextInput
              multiline
              value={body}
              onChangeText={setBody}
              placeholder="Write your post…"
              placeholderTextColor={colors.textSecondary}
              style={styles.textarea}
            />
            <View style={styles.modalButtons}>
              <SecondaryButton title="Cancel" onPress={() => setComposerOpen(false)} disabled={posting} />
              <PrimaryButton title={posting ? 'Publishing…' : 'Publish'} onPress={handleCreate} loading={posting} />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { padding: 16, gap: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderColor: colors.surfaceBorder, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textSecondary, fontSize: 11, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  fieldLabel: { color: colors.textPrimary, fontSize: 13, fontWeight: '600', marginTop: 4, marginBottom: 6 },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(99,102,241,0.15)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  authorName: { color: colors.textPrimary, fontSize: 12, fontWeight: '700' },
  muted: { color: colors.textSecondary, fontSize: 10, marginTop: 1 },
  categoryBadge: { color: colors.primary, fontSize: 9, fontWeight: '700', textTransform: 'uppercase', borderWidth: 1, borderColor: colors.primary, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  postTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: '700', marginTop: 10 },
  postBody: { color: colors.textPrimary, fontSize: 13, marginTop: 4, lineHeight: 18 },
  actionRow: { flexDirection: 'row', gap: 16, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.surfaceBorder },
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  repliesBox: { marginTop: 12, borderTopWidth: 1, borderTopColor: colors.surfaceBorder, paddingTop: 10 },
  replyRow: { backgroundColor: colors.bg, borderRadius: 10, padding: 10, marginBottom: 8 },
  replyAuthor: { color: colors.textSecondary, fontSize: 10, fontWeight: '700' },
  replyBody: { color: colors.textPrimary, fontSize: 12, marginTop: 4 },
  replyInputRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  replyInput: { flex: 1, backgroundColor: colors.bg, borderColor: colors.surfaceBorder, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, color: colors.textPrimary, fontSize: 12 },
  replySend: { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  replySendText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { color: colors.textSecondary, fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: colors.surface, borderRadius: 20, padding: 20, width: '100%', maxWidth: 460, maxHeight: '85%' },
  modalTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '700', marginBottom: 16 },
  textarea: { backgroundColor: colors.bg, borderColor: colors.surfaceBorder, borderWidth: 1, borderRadius: 12, padding: 12, color: colors.textPrimary, fontSize: 13, minHeight: 90, textAlignVertical: 'top', marginTop: 4, marginBottom: 16 },
  modalButtons: { flexDirection: 'row', gap: 10 },
});
