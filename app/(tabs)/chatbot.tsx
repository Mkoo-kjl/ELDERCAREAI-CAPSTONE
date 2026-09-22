import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/providers/AuthProvider';
import { useHealthData } from '@/src/providers/HealthDataProvider';
import { getTheme, palette } from '@/src/theme/colors';

type ElleEmotion = 'happy' | 'neutral' | 'worried';
type Message = { id: string; role: 'user' | 'assistant'; content: string; emotion?: ElleEmotion };
type ElleReply = { content: string; emotion: ElleEmotion };

const elleImages: Record<ElleEmotion, ImageSourcePropType> = {
  happy: require('../../assets/images/elle-happy.png'),
  neutral: require('../../assets/images/elle-neutral.png'),
  worried: require('../../assets/images/elle-worried.png'),
};

const quickTopics = ['Heart Rate', 'SpO₂', 'Sleep', 'Medication', 'Emergency'];
const greeting: Message = {
  id: 'welcome',
  role: 'assistant',
  emotion: 'happy',
  content: "Hi, I'm Elle! I can explain the latest synchronized readings and help you navigate care tasks. I'm a demo assistant, so I don't provide medical diagnoses.",
};

export default function ChatbotScreen() {
  const insets = useSafeAreaInsets();
  const theme = getTheme(useColorScheme() === 'dark');
  const { session } = useAuth();
  const { elderly, vital } = useHealthData();
  const [messages, setMessages] = useState<Message[]>([greeting]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const responseFor = useCallback((raw: string): ElleReply => {
    const text = raw.toLowerCase();
    if (text.includes('emergency') || text.includes('sos')) return { emotion: 'worried', content: 'If someone may be in immediate danger, call your local emergency number now. You can also open Alerts and use SOS to call the saved emergency contact and record the event.' };
    if (text.includes('heart') || text.includes('pulse')) {
      if (vital?.heart_rate_bpm == null) return { emotion: 'neutral', content: 'No heart-rate reading is available yet. Connect and synchronize Google Health from Settings.' };
      const unusual = vital.heart_rate_bpm > 100 || vital.heart_rate_bpm < 50;
      return { emotion: unusual ? 'worried' : 'happy', content: `The latest synchronized heart rate is ${vital.heart_rate_bpm} bpm.${unusual ? ' This is outside the demo threshold, so recheck at rest and seek qualified advice if it persists or symptoms occur.' : ' It is not outside the demo alert thresholds.'} I can summarize readings, but I cannot diagnose a condition.` };
    }
    if (text.includes('spo2') || text.includes('oxygen')) {
      if (vital?.spo2_percent == null) return { emotion: 'neutral', content: 'No blood-oxygen reading is available yet.' };
      const low = vital.spo2_percent < 95;
      return { emotion: low ? 'worried' : 'happy', content: `The latest synchronized SpO₂ reading is ${vital.spo2_percent.toFixed(1)}%.${low ? ' Because this is below the demo threshold, confirm the reading and seek medical guidance if it persists or symptoms are present.' : ' It is not below the demo alert threshold.'}` };
    }
    if (text.includes('sleep')) {
      if (vital?.sleep_hours == null) return { emotion: 'neutral', content: 'No sleep record is available yet.' };
      const short = vital.sleep_hours < 6;
      return { emotion: short ? 'worried' : 'happy', content: `The latest synchronized sleep duration is ${vital.sleep_hours.toFixed(1)} hours.${short ? ' That is shorter than the demo six-hour threshold.' : ''}` };
    }
    if (text.includes('medication') || text.includes('medicine')) return { emotion: 'neutral', content: 'Open Care → Medications to add schedules, review instructions, or mark a scheduled medicine as taken. Always follow the prescriber’s instructions.' };
    if (text.includes('stress')) {
      if (vital?.stress_score == null) return { emotion: 'neutral', content: 'No demo stress score is available yet.' };
      return { emotion: vital.stress_score >= 60 ? 'worried' : 'happy', content: `The current demo stress score is ${vital.stress_score}/100. It is derived for demonstration and is not a clinical measurement.` };
    }
    if (text.includes('temperature') || text.includes('temp')) return vital?.skin_temp_celsius == null
      ? { emotion: 'neutral', content: 'No nightly skin-temperature derivation is available yet.' }
      : { emotion: 'neutral', content: `The latest synchronized nightly temperature value is ${vital.skin_temp_celsius.toFixed(1)} °C. Wearable skin temperature is not the same as a clinical body-temperature reading.` };
    if (text.includes('hello') || text.includes('hi')) return { emotion: 'happy', content: `Hello! I'm Elle. How can I help with ${elderly?.full_name ?? 'your loved one'}’s care today?` };
    if (text.includes('help')) return { emotion: 'happy', content: 'Try asking me about heart rate, SpO₂, sleep, stress, temperature, medication, or emergency actions. I use static demo responses and do not provide medical advice.' };
    return { emotion: 'neutral', content: 'I’m in demo mode and only recognize a few care topics. Try asking about heart rate, SpO₂, sleep, medication, emergency, stress, or temperature.' };
  }, [elderly?.full_name, vital]);

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

  const send = useCallback(async (preset?: string) => {
    const content = (preset ?? input).trim();
    if (!content || typing) return;
    setInput('');
    const userMessage: Message = { id: `u-${Date.now()}`, role: 'user', content };
    setMessages((current) => [...current, userMessage]);
    setTyping(true);
    try {
      const activeSessionId = await ensureSession();
      const { error: userError } = await supabase.from('ai_chatbot_messages').insert({ session_id: activeSessionId, role: 'user', content, has_health_data: false });
      if (userError) throw userError;
      await new Promise((resolve) => setTimeout(resolve, 1200 + Math.floor(Math.random() * 801)));
      const reply = responseFor(content);
      const { error: assistantError } = await supabase.from('ai_chatbot_messages').insert({ session_id: activeSessionId, role: 'assistant', content: reply.content, has_health_data: Boolean(vital) });
      if (assistantError) throw assistantError;
      await supabase.from('ai_chatbot_sessions').update({ total_messages: messages.length + 2 }).eq('id', activeSessionId);
      setMessages((current) => [...current, { id: `a-${Date.now()}`, role: 'assistant', content: reply.content, emotion: reply.emotion }]);
    } catch (caught) {
      setMessages((current) => [...current, { id: `e-${Date.now()}`, role: 'assistant', emotion: 'worried', content: caught instanceof Error ? `I couldn't save that message: ${caught.message}` : "I couldn't save that message." }]);
    } finally {
      setTyping(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [ensureSession, input, messages.length, responseFor, typing, vital]);

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
        <View style={styles.titleRow}><View style={[styles.headerAvatar, { backgroundColor: theme.card }]}><Image source={elleImages.happy} style={styles.headerMascot} resizeMode="cover" /></View><View><Text style={[styles.title, { color: theme.text }]}>Elle</Text><View style={styles.statusRow}><View style={styles.statusDot} /><Text style={[styles.status, { color: theme.subtitle }]}>ElderCare AI • Demo Mode</Text></View></View></View>
        <Pressable onPress={() => void newChat()} style={[styles.newButton, { backgroundColor: theme.card }]}><Ionicons name="add" size={17} color={palette.primaryDark} /><Text style={styles.newText}>New Chat</Text></Pressable>
      </View>
      <ScrollView ref={scrollRef} style={styles.messages} contentContainerStyle={styles.messageContent} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'} onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
        {fresh ? <><LinearGradient colors={['#EAF8FF', '#F2FFF1']} style={styles.elleCard}><View style={styles.ellePortrait}><Image source={elleImages.happy} style={styles.elleHeroImage} resizeMode="cover" /></View><View style={styles.elleIntro}><Text style={styles.elleGreeting}>Meet Elle</Text><Text style={styles.elleDescription}>Your friendly care companion for health summaries and everyday guidance.</Text></View></LinearGradient><View style={styles.quickWrap}><Text style={[styles.quickLabel, { color: theme.subtitle }]}>ASK ELLE ABOUT</Text><View style={styles.quickRow}>{quickTopics.map((topic) => <Pressable key={topic} onPress={() => void send(topic)} style={[styles.quickChip, { backgroundColor: theme.card, borderColor: theme.border }]}><Text style={[styles.quickText, { color: theme.text }]}>{topic}</Text></Pressable>)}</View></View></> : null}
        {messages.map((message) => <View key={message.id} style={[styles.bubbleRow, message.role === 'user' && styles.userRow]}>{message.role === 'assistant' ? <ElleAvatar emotion={message.emotion ?? 'neutral'} /> : null}<View style={[styles.bubble, message.role === 'user' ? styles.userBubble : { backgroundColor: theme.card, borderColor: theme.border }]}>{message.role === 'assistant' ? <Text style={styles.elleName}>ELLE</Text> : null}<Text style={[styles.messageText, { color: message.role === 'user' ? '#FFFFFF' : theme.text }]}>{message.content}</Text></View></View>)}
        {typing ? <View style={styles.bubbleRow}><ElleAvatar emotion="neutral" /><View style={[styles.typing, { backgroundColor: theme.card }]}><ActivityIndicator size="small" color={palette.primaryDark} /><Text style={{ color: theme.subtitle, fontSize: 12 }}>Elle is thinking…</Text></View></View> : null}
      </ScrollView>
      <View style={[styles.composer, { borderTopColor: theme.border, backgroundColor: theme.cardElevated, paddingBottom: Math.max(insets.bottom, 10) }]}><TextInput value={input} onChangeText={setInput} onSubmitEditing={() => void send()} placeholder="Ask about health or care…" placeholderTextColor={theme.subtitle} style={[styles.input, { color: theme.text, backgroundColor: theme.card, borderColor: theme.border }]} multiline blurOnSubmit={false} textAlignVertical="top" /><Pressable accessibilityLabel="Send message" onPress={() => void send()} disabled={!input.trim() || typing}><LinearGradient colors={[palette.primary, palette.primaryDark]} style={[styles.send, (!input.trim() || typing) && { opacity: 0.45 }]}><Ionicons name="send" size={19} color="#FFFFFF" /></LinearGradient></Pressable></View>
    </KeyboardAvoidingView>
  );
}

function ElleAvatar({ emotion }: { emotion: ElleEmotion }) {
  return <View style={styles.avatar}><Image source={elleImages[emotion]} style={styles.avatarImage} resizeMode="cover" /></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, header: { height: 78, paddingHorizontal: 16, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, headerAvatar: { width: 50, height: 50, borderRadius: 18, borderWidth: 2, borderColor: '#B8ECDA', overflow: 'hidden', shadowColor: '#1C769C', shadowOpacity: 0.16, shadowRadius: 7, elevation: 3 }, headerMascot: { width: '100%', height: '100%' }, title: { fontSize: 21, fontWeight: '800', letterSpacing: -0.3 }, statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }, statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: palette.accent }, status: { fontSize: 9.5, fontWeight: '600' }, newButton: { borderRadius: 12, paddingHorizontal: 9, height: 36, flexDirection: 'row', alignItems: 'center', gap: 3 }, newText: { color: palette.primaryDark, fontSize: 10.5, fontWeight: '700' },
  messages: { flex: 1 }, messageContent: { padding: 16, paddingBottom: 28 }, elleCard: { minHeight: 112, borderRadius: 20, marginBottom: 17, padding: 14, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#CDEEE8', overflow: 'hidden' }, ellePortrait: { width: 94, height: 78, borderRadius: 20, overflow: 'hidden', backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#FFFFFF', shadowColor: '#256C8A', shadowOpacity: 0.14, shadowRadius: 7, elevation: 3 }, elleHeroImage: { width: '100%', height: '100%' }, elleIntro: { flex: 1, marginLeft: 13 }, elleGreeting: { color: '#173C56', fontSize: 20, fontWeight: '900', letterSpacing: -0.3 }, elleDescription: { marginTop: 4, color: '#527185', fontSize: 11.5, lineHeight: 17 }, quickWrap: { marginBottom: 17 }, quickLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 9 }, quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, quickChip: { borderWidth: 1, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20 }, quickText: { fontSize: 11.5, fontWeight: '600' }, bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12, maxWidth: '92%' }, userRow: { alignSelf: 'flex-end', justifyContent: 'flex-end' }, avatar: { width: 38, height: 38, marginRight: 8, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#B8ECDA', overflow: 'hidden', shadowColor: '#1C769C', shadowOpacity: 0.12, shadowRadius: 5, elevation: 2 }, avatarImage: { width: '100%', height: '100%' }, bubble: { maxWidth: '88%', paddingHorizontal: 14, paddingVertical: 11, borderRadius: 17, borderWidth: 1 }, userBubble: { backgroundColor: palette.primaryDark, borderColor: palette.primaryDark, borderBottomRightRadius: 5 }, elleName: { color: palette.accentDark, fontSize: 8.5, fontWeight: '900', letterSpacing: 1, marginBottom: 3 }, messageText: { fontSize: 13, lineHeight: 19 }, typing: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  composer: { paddingTop: 10, paddingHorizontal: 13, borderTopWidth: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 9 }, input: { flex: 1, minHeight: 45, maxHeight: 105, borderWidth: 1, borderRadius: 14, paddingHorizontal: 13, paddingVertical: 11, fontSize: 13 }, send: { width: 45, height: 45, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
