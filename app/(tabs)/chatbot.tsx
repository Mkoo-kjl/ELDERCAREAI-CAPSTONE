import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  type ImageSourcePropType,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/src/components/AppText';
import { getFunctionErrorMessage } from '@/src/lib/function-error';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/providers/AuthProvider';
import { useHealthData } from '@/src/providers/HealthDataProvider';
import { getTheme, palette } from '@/src/theme/colors';
import { fontFamily, typeScale } from '@/src/theme/typography';

type ElleEmotion = 'happy' | 'neutral' | 'worried';
type ChatAction = { label: string; icon: keyof typeof Ionicons.glyphMap; href: Href };
type Message = { id: string; role: 'user' | 'assistant'; content: string; emotion?: ElleEmotion; actions?: ChatAction[] };
type AiAssistantResponse = { reply?: string; content?: string; emotion?: ElleEmotion; hasHealthData?: boolean; code?: string };

const elleImages: Record<ElleEmotion, ImageSourcePropType> = {
  happy: require('../../assets/images/elle-happy.png'),
  neutral: require('../../assets/images/elle-neutral.png'),
  worried: require('../../assets/images/elle-worried.png'),
};

const quickTopics = ['Patient Name', 'Vitals', 'Sleep Today', 'Medication', 'Emergency'];
const greeting: Message = {
  id: 'welcome',
  role: 'assistant',
  emotion: 'happy',
  content: "Hi, I'm Elle! I can help caregivers summarize patient data, care tasks, and synced readings. I'm not a medical-grade AI and I don't diagnose or replace professional medical advice.",
};

function elleErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message.trim() : '';
  if (!message) return "I couldn't reach the care assistant right now. Please try again in a moment.";
  if (/usage limit|quota|rate limit|too many requests/i.test(message)) {
    return "Gemini's usage limit was reached. Please wait a bit, then try Elle again.";
  }
  if (/billing|credits|payment/i.test(message)) {
    return "Gemini billing or credits need attention before Elle can answer.";
  }
  if (/api key|configured api key|supabase gemini secret/i.test(message)) {
    return "Elle's Gemini API key needs to be checked in Supabase before I can answer.";
  }
  if (/model is not available|configured gemini model|not available for this api key/i.test(message)) {
    return "Elle's Gemini model is not available for this API key. Please update the configured model.";
  }
  if (/gemini is not reachable|network|timeout/i.test(message)) {
    return 'Gemini is not reachable right now. Please try again in a moment.';
  }
  return "I couldn't reach the care assistant right now. Please try again in a moment.";
}

function actionsForAssistantText(text: string): ChatAction[] {
  const normalized = text.toLowerCase();
  const actions: ChatAction[] = [];
  const add = (action: ChatAction) => {
    if (!actions.some((item) => item.label === action.label)) actions.push(action);
  };

  if (/(vital|heart|oxygen|spo2|sleep|steps|temperature|reading|sync)/i.test(normalized)) {
    add({ label: 'View Vitals', icon: 'pulse-outline', href: '/dashboard' as Href });
  }
  if (/(medication|medicine|dose|taken|pill)/i.test(normalized)) {
    add({ label: 'Open Meds', icon: 'medkit-outline', href: '/care?tab=Medications' as Href });
  }
  if (/(appointment|doctor visit|checkup|schedule)/i.test(normalized)) {
    add({ label: 'Appointments', icon: 'calendar-outline', href: '/care?tab=Appointments' as Href });
  }
  if (/(note|caregiver note|handoff)/i.test(normalized)) {
    add({ label: 'Notes', icon: 'document-text-outline', href: '/care?tab=Notes' as Href });
  }
  if (/(emergency|sos|urgent|alert|danger|call local emergency)/i.test(normalized)) {
    add({ label: 'Open Alerts', icon: 'alert-circle-outline', href: '/alerts?tab=Emergency' as Href });
  }
  if (/(doctor|physician|clinic|call doctor)/i.test(normalized)) {
    add({ label: 'Doctor Info', icon: 'medical-outline', href: '/profile' as Href });
  }
  return actions.slice(0, 3);
}

export default function ChatbotScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const theme = getTheme(useColorScheme() === 'dark');
  const { session } = useAuth();
  const { elderly, vital } = useHealthData();
  const [messages, setMessages] = useState<Message[]>([greeting]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const ensureSession = useCallback(async () => {
    if (sessionId) return sessionId;
    if (!session || !elderly) throw new Error('Your care profile is not ready.');
    const { data, error } = await supabase.from('ai_chatbot_sessions').insert({
      elderly_id: elderly.elderly_id,
      caregiver_id: session.user.id,
      session_title: `Elle care chat ${new Date().toLocaleDateString()}`,
      context_type: 'general',
    }).select('id').single();
    if (error) throw error;
    setSessionId(data.id);
    return data.id as string;
  }, [elderly, session, sessionId]);

  const askElle = useCallback(async (content: string, activeSessionId: string) => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const { data, error } = await supabase.functions.invoke<AiAssistantResponse>('ai-care-assistant', {
      body: {
        message: content,
        sessionId: activeSessionId,
        clientNow: new Date().toISOString(),
        timeZone,
      },
    });
    if (error) throw new Error(await getFunctionErrorMessage(error, 'Elle could not reach Gemini right now.'));

    const replyContent = (data?.reply ?? data?.content ?? '').trim();
    if (!replyContent) throw new Error('Elle did not return a response.');

    return {
      content: replyContent,
      emotion: data?.emotion ?? 'neutral',
      hasHealthData: data?.hasHealthData ?? Boolean(vital),
    };
  }, [vital]);

  const send = useCallback(async (preset?: string) => {
    const content = (preset ?? input).trim();
    if (!content || typing) return;
    setInput('');
    const userMessage: Message = { id: `u-${Date.now()}`, role: 'user', content };
    setMessages((current) => [...current, userMessage]);
    setTyping(true);
    try {
      const activeSessionId = await ensureSession();
      const reply = await askElle(content, activeSessionId);
      const sentAt = new Date();
      const repliedAt = new Date(sentAt.getTime() + 1);
      const { error: persistError } = await supabase.from('ai_chatbot_messages').insert([
        { session_id: activeSessionId, role: 'user', content, has_health_data: false, created_at: sentAt.toISOString() },
        { session_id: activeSessionId, role: 'assistant', content: reply.content, has_health_data: reply.hasHealthData, created_at: repliedAt.toISOString() },
      ]);
      if (persistError) {
        console.warn('Elle chat persistence failed:', persistError.message);
      } else {
        const { error: sessionError } = await supabase.from('ai_chatbot_sessions').update({ total_messages: messages.length + 2 }).eq('id', activeSessionId);
        if (sessionError) console.warn('Elle chat session count failed:', sessionError.message);
      }
      setMessages((current) => [...current, { id: `a-${Date.now()}`, role: 'assistant', content: reply.content, emotion: reply.emotion, actions: actionsForAssistantText(reply.content) }]);
    } catch (caught) {
      console.warn('Elle chat failed:', caught instanceof Error ? caught.message : caught);
      setMessages((current) => [...current, { id: `e-${Date.now()}`, role: 'assistant', emotion: 'worried', content: elleErrorMessage(caught) }]);
    } finally {
      setTyping(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [askElle, ensureSession, input, messages.length, typing]);

  const newChat = useCallback(async () => {
    if (sessionId) await supabase.from('ai_chatbot_sessions').update({ is_active: false, ended_at: new Date().toISOString() }).eq('id', sessionId);
    setSessionId(null);
    setMessages([greeting]);
    setInput('');
  }, [sessionId]);

  const fresh = useMemo(() => messages.length === 1, [messages.length]);
  return (
    <KeyboardAvoidingView style={[styles.screen, { backgroundColor: theme.background, paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <View style={styles.titleRow}><View style={[styles.headerAvatar, { backgroundColor: theme.card }]}><Image source={elleImages.happy} style={styles.headerMascot} resizeMode="cover" /></View><View><Text style={[styles.title, { color: theme.text }]}>Elle</Text><View style={styles.statusRow}><View style={styles.statusDot} /><Text style={[styles.status, { color: theme.subtitle }]}>Care assistant</Text></View></View></View>
        <Pressable onPress={() => void newChat()} style={[styles.newButton, { backgroundColor: theme.card }]}><Ionicons name="add" size={17} color={palette.primaryDark} /><Text style={styles.newText}>New Chat</Text></Pressable>
      </View>
      <ScrollView ref={scrollRef} style={styles.messages} contentContainerStyle={styles.messageContent} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'} onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
        {fresh ? <><View style={[styles.elleCard, { backgroundColor: theme.cardElevated }]}><View style={styles.ellePortrait}><Image source={elleImages.happy} style={styles.elleHeroImage} resizeMode="cover" /></View><View style={styles.elleIntro}><Text style={[styles.elleGreeting, { color: theme.text }]}>Meet Elle</Text><Text style={[styles.elleDescription, { color: theme.subtitle }]}>Care summaries and everyday guidance for caregivers.</Text></View></View><View style={styles.quickWrap}><Text style={[styles.quickLabel, { color: theme.subtitle }]}>ASK ELLE ABOUT</Text><View style={styles.quickRow}>{quickTopics.map((topic) => <Pressable key={topic} onPress={() => void send(topic)} style={[styles.quickChip, { backgroundColor: theme.cardElevated }]}><Text style={[styles.quickText, { color: theme.text }]}>{topic}</Text></Pressable>)}</View></View></> : null}
        {messages.map((message) => <View key={message.id} style={[styles.bubbleRow, message.role === 'user' && styles.userRow]}>{message.role === 'assistant' ? <ElleAvatar emotion={message.emotion ?? 'neutral'} /> : null}<View style={[styles.bubble, message.role === 'user' ? styles.userBubble : { backgroundColor: theme.card }]}>{message.role === 'assistant' ? <Text style={styles.elleName}>ELLE</Text> : null}<Text style={[styles.messageText, { color: message.role === 'user' ? '#FFFFFF' : theme.text }]}>{message.content}</Text>{message.role === 'assistant' && message.actions?.length ? <View style={styles.replyActions}>{message.actions.map((action) => <Pressable key={action.label} onPress={() => router.push(action.href)} style={[styles.replyAction, { backgroundColor: theme.cardElevated }]}><Ionicons name={action.icon} size={14} color={palette.primaryDark} /><Text style={styles.replyActionText}>{action.label}</Text></Pressable>)}</View> : null}</View></View>)}
        {typing ? <View style={styles.bubbleRow}><ElleAvatar emotion="neutral" /><View style={[styles.typing, { backgroundColor: theme.card }]}><ActivityIndicator size="small" color={palette.primaryDark} /><Text style={{ color: theme.subtitle, fontSize: 12 }}>Elle is thinking…</Text></View></View> : null}
      </ScrollView>
      <View style={[styles.composer, { borderTopColor: theme.border, backgroundColor: theme.cardElevated, paddingBottom: Math.max(insets.bottom, 10) }]}><TextInput value={input} onChangeText={setInput} onSubmitEditing={() => void send()} placeholder="Ask about health or care…" placeholderTextColor={theme.subtitle} style={[styles.input, { color: theme.text, backgroundColor: theme.card, borderColor: theme.border }]} multiline blurOnSubmit={false} textAlignVertical="top" /><Pressable accessibilityLabel="Send message" onPress={() => void send()} disabled={!input.trim() || typing}><View style={[styles.send, (!input.trim() || typing) && { opacity: 0.45 }]}><Ionicons name="send" size={18} color="#FFFFFF" /></View></Pressable></View>
    </KeyboardAvoidingView>
  );
}

function ElleAvatar({ emotion }: { emotion: ElleEmotion }) {
  return <View style={styles.avatar}><Image source={elleImages[emotion]} style={styles.avatarImage} resizeMode="cover" /></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, header: { height: 70, paddingHorizontal: 16, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, headerAvatar: { width: 43, height: 43, borderRadius: 14, overflow: 'hidden' }, headerMascot: { width: '100%', height: '100%' }, title: { ...typeScale.sectionTitle }, statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 }, statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: palette.accentDark }, status: { fontSize: 10, fontFamily: fontFamily.regular }, newButton: { borderRadius: 14, paddingHorizontal: 9, height: 34, flexDirection: 'row', alignItems: 'center', gap: 3 }, newText: { color: palette.primaryDark, fontSize: 10.5, fontFamily: fontFamily.medium },
  messages: { flex: 1 }, messageContent: { padding: 16, paddingBottom: 28 }, elleCard: { minHeight: 100, borderRadius: 14, marginBottom: 17, padding: 12, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' }, ellePortrait: { width: 72, height: 72, borderRadius: 11, overflow: 'hidden', backgroundColor: palette.aquaSurface }, elleHeroImage: { width: '100%', height: '100%' }, elleIntro: { flex: 1, marginLeft: 12 }, elleGreeting: { ...typeScale.sectionTitle }, elleDescription: { marginTop: 4, ...typeScale.subhead }, quickWrap: { marginBottom: 17 }, quickLabel: { ...typeScale.eyebrow, marginBottom: 9 }, quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, quickChip: { paddingVertical: 8, paddingHorizontal: 11, borderRadius: 14 }, quickText: { fontSize: 12, fontFamily: fontFamily.medium }, bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12, maxWidth: '94%' }, userRow: { alignSelf: 'flex-end', justifyContent: 'flex-end' }, avatar: { width: 32, height: 32, marginRight: 8, borderRadius: 11, backgroundColor: palette.aquaSurface, overflow: 'hidden' }, avatarImage: { width: '100%', height: '100%' }, bubble: { maxWidth: '88%', paddingHorizontal: 13, paddingVertical: 10, borderRadius: 14 }, userBubble: { backgroundColor: palette.primaryDark }, elleName: { color: palette.accentDark, ...typeScale.eyebrow, marginBottom: 3 }, messageText: { ...typeScale.body }, replyActions: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, replyAction: { minHeight: 31, borderRadius: 11, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 4 }, replyActionText: { color: palette.primaryDark, fontSize: 11, fontFamily: fontFamily.semiBold }, typing: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  composer: { paddingTop: 10, paddingHorizontal: 13, borderTopWidth: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 9 }, input: { flex: 1, minHeight: 45, maxHeight: 105, borderWidth: 1, borderRadius: 14, paddingHorizontal: 13, paddingVertical: 11, ...typeScale.body }, send: { width: 45, height: 45, borderRadius: 14, backgroundColor: palette.primaryDark, alignItems: 'center', justifyContent: 'center' },
});
