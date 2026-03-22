import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Fonts } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type ResultType = 'win' | 'middle' | 'loss';

type Room = {
  id: string;
  name: string;
  code: string;
};

type RoomMember = {
  room_id: string;
  user_id: string;
  display_name: string | null;
};

type MatchResult = {
  id: string;
  room_id: string;
  user_id: string;
  result: ResultType;
  created_at: string;
};

type LogEntry = {
  id: string;
  room: string;
  player: string;
  result: ResultType;
  timestamp: string;
};

export default function LogScreen() {
  const [profileName, setProfileName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [result, setResult] = useState<ResultType>('win');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [results, setResults] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setLoading(false);
      return;
    }

    const [{ data: profileData }, { data: roomMemberships }] = await Promise.all([
      supabase.from('profiles').select('id, display_name').eq('id', userData.user.id).maybeSingle(),
      supabase
        .from('room_members')
        .select('room_id, rooms ( id, name, code )')
        .eq('user_id', userData.user.id),
    ]);

    const roomList = (roomMemberships ?? []).flatMap((membership) => {
      const joined = membership.rooms as Room | Room[] | null | undefined;
      if (!joined) return [];
      const list = Array.isArray(joined) ? joined : [joined];
      return list.map((room) => ({
        id: room.id ?? '',
        name: room.name ?? 'Unnamed Table',
        code: room.code ?? 'UNKNOWN',
      }));
    });

    const roomIds = roomList.map((room) => room.id).filter(Boolean);
    const [{ data: memberData }, { data: resultsData }] = await Promise.all([
      supabase
        .from('room_members')
        .select('room_id, user_id, display_name')
        .in('room_id', roomIds.length ? roomIds : ['']),
      supabase
        .from('match_results')
        .select('id, room_id, user_id, result, created_at')
        .in('room_id', roomIds.length ? roomIds : [''])
        .order('created_at', { ascending: false })
        .limit(25),
    ]);

    setProfileName(profileData?.display_name ?? userData.user.email ?? '');
    setRooms(roomList);
    setMembers(memberData ?? []);
    setResults(resultsData ?? []);
    setRoomCode(roomList[0]?.code ?? '');
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const activeRoom = rooms.find((room) => room.code === roomCode) ?? rooms[0];
  const activeRoomResults = useMemo(() => {
    if (!activeRoom) return [];
    return results.filter((item) => item.room_id === activeRoom.id);
  }, [activeRoom, results]);

  const roomTotals = useMemo(() => {
    return activeRoomResults.reduce(
      (acc, item) => {
        if (item.result === 'win') acc.wins += 1;
        if (item.result === 'loss') acc.losses += 1;
        if (item.result === 'middle') acc.middle += 1;
        acc.total += 1;
        return acc;
      },
      { wins: 0, losses: 0, middle: 0, total: 0 }
    );
  }, [activeRoomResults]);

  const total = roomTotals.total || 1;
  const winPct = Math.round((roomTotals.wins / total) * 100);
  const lossPct = Math.round((roomTotals.losses / total) * 100);
  const middlePct = Math.max(0, 100 - winPct - lossPct);

  const history: LogEntry[] = useMemo(() => {
    return results.map((entry) => {
      const roomName = rooms.find((room) => room.id === entry.room_id)?.name ?? 'Table';
      const playerName = members.find((member) => member.user_id === entry.user_id)?.display_name ?? 'Player';
      return {
        id: entry.id,
        room: roomName,
        player: playerName,
        result: entry.result,
        timestamp: new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
    });
  }, [results, rooms, members]);

  const handleLog = async () => {
    if (!activeRoom) return;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { error } = await supabase.from('match_results').insert({
      room_id: activeRoom.id,
      user_id: userData.user.id,
      result,
    });

    if (error) {
      Alert.alert('Unable to log', error.message);
      return;
    }

    loadData();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingScreen}>
          <ActivityIndicator size="large" color={palette.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>SIC Arena</Text>
            <Text style={styles.subtitle}>Pusoy Dos Log</Text>
          </View>
          <TouchableOpacity style={styles.iconButton} activeOpacity={0.8}>
            <MaterialIcons name="tune" size={20} color={palette.textMuted} />
          </TouchableOpacity>
        </View>

      <View style={styles.heroCard}>
        <Text style={styles.sectionLabel}>Match Outcome</Text>
        <Text style={styles.heroHint}>Mark if you finished first, last, or in the middle.</Text>
      </View>

      <View style={styles.roomSnapshot}>
        <View style={styles.roomSnapshotHeader}>
          <View>
            <Text style={styles.sectionLabel}>Active Table</Text>
            <Text style={styles.roomName}>{activeRoom?.name ?? 'No table'}</Text>
            <Text style={styles.roomCode}>Table Code • {activeRoom?.code ?? '--'}</Text>
          </View>
          <View style={styles.roomBadge}>
            <Text style={styles.roomBadgeLabel}>Win %</Text>
            <Text style={styles.roomBadgeValue}>{winPct}%</Text>
          </View>
        </View>
        <View style={styles.roomTotals}>
          <View>
            <Text style={styles.roomTotalLabel}>Wins</Text>
            <Text style={[styles.roomTotalValue, { color: palette.primary }]}>{roomTotals.wins}</Text>
          </View>
          <View>
            <Text style={styles.roomTotalLabel}>Middle</Text>
            <Text style={[styles.roomTotalValue, { color: palette.tertiary }]}>{roomTotals.middle}</Text>
          </View>
          <View>
            <Text style={styles.roomTotalLabel}>Losses</Text>
            <Text style={[styles.roomTotalValue, { color: palette.secondary }]}>{roomTotals.losses}</Text>
          </View>
          <View>
            <Text style={styles.roomTotalLabel}>Loss %</Text>
            <Text style={[styles.roomTotalValue, { color: palette.secondary }]}>{lossPct}%</Text>
          </View>
          <View>
            <Text style={styles.roomTotalLabel}>Middle %</Text>
            <Text style={[styles.roomTotalValue, { color: palette.tertiary }]}>{middlePct}%</Text>
          </View>
        </View>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.sectionTitle}>Log a Result</Text>
        <Text style={styles.sectionSubtitle}>Record wins, losses, or middle finishes.</Text>

        <View style={styles.inputField}>
          <Text style={styles.inputLabel}>Table Code</Text>
          <TextInput
            placeholder="Enter table code"
            placeholderTextColor={palette.textMuted}
            style={styles.input}
            value={roomCode}
            onChangeText={setRoomCode}
          />
        </View>

        <View style={styles.inputField}>
          <Text style={styles.inputLabel}>Player</Text>
          <TextInput
            placeholder="Enter player callsign"
            placeholderTextColor={palette.textMuted}
            style={styles.input}
            value={profileName}
            editable={false}
          />
        </View>

        <View style={styles.resultRow}>
          {(
            [
              { key: 'win' as ResultType, label: 'Winner', color: palette.primary },
              { key: 'middle' as ResultType, label: 'Middle', color: palette.tertiary },
              { key: 'loss' as ResultType, label: 'Last', color: palette.secondary },
            ]
          ).map((option) => (
            <TouchableOpacity
              key={option.key}
              style={[styles.resultChip, result === option.key && styles.resultChipActive]}
              onPress={() => setResult(option.key)}>
              <Text style={[styles.resultChipText, result === option.key && { color: option.color }]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.primaryButton} activeOpacity={0.85} onPress={handleLog}>
          <Text style={styles.primaryButtonText}>Log Result</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.historyCard}>
        <View style={styles.historyHeader}>
          <Text style={styles.sectionTitle}>Recent Logs</Text>
          <Text style={styles.historyMeta}>Last 3 rounds</Text>
        </View>
        {history.map((entry) => (
          <View key={entry.id} style={styles.historyRow}>
            <View style={[styles.historyMarker, historyMarkerStyle(entry.result)]} />
            <View style={styles.historyInfo}>
              <Text style={styles.historyName}>{entry.player}</Text>
              <Text style={styles.historyTime}>{entry.timestamp} • {entry.room}</Text>
            </View>
            <Text style={[styles.historyScore, historyScoreStyle(entry.result)]}>
              {entry.result === 'win' ? 'WIN' : entry.result === 'middle' ? 'MIDDLE' : 'LOSS'}
            </Text>
          </View>
        ))}
      </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const palette = {
  background: '#0c0e17',
  surfaceLow: '#11131d',
  surface: '#171924',
  surfaceHigh: '#222532',
  surfaceBright: '#282b3a',
  primary: '#9cff93',
  secondary: '#ff7168',
  tertiary: '#81ecff',
  text: '#f0f0fd',
  textMuted: '#aaaab7',
  outline: '#464752',
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  safeArea: {
    flex: 1,
    backgroundColor: palette.background,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: palette.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 120,
    gap: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    fontFamily: Fonts.rounded,
    color: palette.primary,
    fontSize: 22,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  subtitle: {
    color: palette.textMuted,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCard: {
    backgroundColor: palette.surfaceLow,
    borderRadius: 20,
    padding: 20,
    gap: 16,
  },
  sectionLabel: {
    color: palette.textMuted,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  heroHint: {
    color: palette.textMuted,
    fontSize: 12,
  },
  roomSnapshot: {
    backgroundColor: palette.surfaceLow,
    borderRadius: 22,
    padding: 18,
    gap: 12,
  },
  roomSnapshotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roomName: {
    color: palette.text,
    fontFamily: Fonts.rounded,
    fontSize: 18,
    marginTop: 4,
  },
  roomCode: {
    color: palette.textMuted,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  roomBadge: {
    backgroundColor: palette.surfaceHigh,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  roomBadgeLabel: {
    color: palette.textMuted,
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  roomBadgeValue: {
    color: palette.primary,
    fontFamily: Fonts.rounded,
    fontSize: 14,
    marginTop: 4,
  },
  roomTotals: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  roomTotalLabel: {
    color: palette.textMuted,
    fontSize: 9,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  roomTotalValue: {
    color: palette.text,
    fontSize: 16,
    fontFamily: Fonts.rounded,
  },
  formCard: {
    backgroundColor: palette.surfaceLow,
    borderRadius: 20,
    padding: 20,
    gap: 16,
  },
  sectionTitle: {
    color: palette.text,
    fontFamily: Fonts.rounded,
    fontSize: 18,
    textTransform: 'uppercase',
  },
  sectionSubtitle: {
    color: palette.textMuted,
    fontSize: 12,
  },
  inputField: {
    gap: 8,
  },
  inputLabel: {
    color: palette.textMuted,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: palette.surface,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    color: palette.text,
    fontSize: 14,
  },
  resultRow: {
    flexDirection: 'row',
    gap: 10,
  },
  resultChip: {
    flex: 1,
    backgroundColor: palette.surface,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  resultChipActive: {
    borderWidth: 1,
    borderColor: palette.outline,
    backgroundColor: palette.surfaceHigh,
  },
  resultChipText: {
    color: palette.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  primaryButton: {
    backgroundColor: palette.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#00440a',
    fontFamily: Fonts.rounded,
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  historyCard: {
    backgroundColor: palette.surfaceLow,
    borderRadius: 20,
    padding: 20,
    gap: 12,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyMeta: {
    color: palette.textMuted,
    fontSize: 10,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: palette.surface,
    borderRadius: 14,
    padding: 12,
  },
  historyMarker: {
    width: 4,
    height: 28,
    borderRadius: 2,
  },
  historyInfo: {
    flex: 1,
  },
  historyName: {
    color: palette.text,
    fontFamily: Fonts.rounded,
    fontSize: 14,
  },
  historyTime: {
    color: palette.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  historyScore: {
    fontFamily: Fonts.rounded,
    fontSize: 16,
  },
});

const historyMarkerStyle = (result: ResultType) => ({
  backgroundColor: result === 'win' ? palette.primary : result === 'middle' ? palette.tertiary : palette.secondary,
});

const historyScoreStyle = (result: ResultType) => ({
  color: result === 'win' ? palette.primary : result === 'middle' ? palette.tertiary : palette.secondary,
});
