import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Fonts } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type Profile = {
  id: string;
  display_name: string | null;
};

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
  room_id: string;
  user_id: string;
  result: 'win' | 'loss' | 'middle';
};

type RoomStat = Room & {
  wins: number;
  losses: number;
  middle: number;
  players: Array<{
    id: string;
    name: string;
    winPct: number;
    lossPct: number;
    middlePct: number;
  }>;
};

export default function RoomsScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [results, setResults] = useState<MatchResult[]>([]);
  const [joinCode, setJoinCode] = useState('');
  const [tableName, setTableName] = useState('');
  const [loading, setLoading] = useState(true);

  const loadRooms = async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setLoading(false);
      return;
    }

    const [{ data: profileData }, { data: roomMemberships }, { data: resultsData }] = await Promise.all([
      supabase.from('profiles').select('id, display_name').eq('id', userData.user.id).maybeSingle(),
      supabase
        .from('room_members')
        .select('room_id, rooms ( id, name, code )')
        .eq('user_id', userData.user.id),
      supabase.from('match_results').select('room_id, user_id, result'),
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
    const { data: memberData } = await supabase
      .from('room_members')
      .select('room_id, user_id, display_name')
      .in('room_id', roomIds.length ? roomIds : ['']);

    setProfile(profileData ?? null);
    setRooms(roomList);
    setMembers(memberData ?? []);
    setResults(resultsData ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadRooms();
  }, []);

  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data: room, error } = await supabase
      .from('rooms')
      .select('id, name, code')
      .eq('code', joinCode.trim())
      .maybeSingle();

    if (error || !room) {
      Alert.alert('Table not found', 'Check the table code and try again.');
      return;
    }

    const { error: memberError } = await supabase.from('room_members').insert({
      room_id: room.id,
      user_id: userData.user.id,
      display_name: profile?.display_name ?? userData.user.email,
    });

    if (memberError) {
      Alert.alert('Unable to join', memberError.message);
      return;
    }

    setJoinCode('');
    loadRooms();
  };

  const handleCreate = async () => {
    if (!tableName.trim()) return;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const code = `PD-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const { data: room, error } = await supabase
      .from('rooms')
      .insert({ name: tableName.trim(), code, created_by: userData.user.id })
      .select('id, name, code')
      .single();

    if (error || !room) {
      Alert.alert('Unable to create', error?.message ?? 'Try again.');
      return;
    }

    await supabase.from('room_members').insert({
      room_id: room.id,
      user_id: userData.user.id,
      display_name: profile?.display_name ?? userData.user.email,
    });

    setTableName('');
    loadRooms();
  };

  const roomStats = useMemo<RoomStat[]>(() => {
    return rooms.map((room) => {
      const roomResults = results.filter((item) => item.room_id === room.id);
      const stats = roomResults.reduce(
        (acc, item) => {
          if (item.result === 'win') acc.wins += 1;
          if (item.result === 'loss') acc.losses += 1;
          if (item.result === 'middle') acc.middle += 1;
          return acc;
        },
        { wins: 0, losses: 0, middle: 0 }
      );

      const playerStats = members
        .filter((member) => member.room_id === room.id)
        .map((member) => {
          const memberResults = roomResults.filter((item) => item.user_id === member.user_id);
          const totals = memberResults.reduce(
            (acc, item) => {
              if (item.result === 'win') acc.wins += 1;
              if (item.result === 'loss') acc.losses += 1;
              if (item.result === 'middle') acc.middle += 1;
              acc.total += 1;
              return acc;
            },
            { wins: 0, losses: 0, middle: 0, total: 0 }
          );
          const total = totals.total;
          const winPct = total ? Math.round((totals.wins / total) * 100) : 0;
          const lossPct = total ? Math.round((totals.losses / total) * 100) : 0;
          const middlePct = total ? Math.max(0, 100 - winPct - lossPct) : 0;
          return {
            id: member.user_id,
            name: member.display_name ?? 'Player',
            winPct,
            lossPct,
            middlePct,
          };
        })
        .sort((a, b) => b.winPct - a.winPct);

      return {
        ...room,
        ...stats,
        players: playerStats,
      };
    });
  }, [rooms, results, members]);

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
            <Text style={styles.subtitle}>Pusoy Dos Tables</Text>
          </View>
          <TouchableOpacity style={styles.iconButton} activeOpacity={0.85}>
            <MaterialIcons name="settings" size={20} color={palette.textMuted} />
          </TouchableOpacity>
        </View>

      <View style={styles.joinCard}>
        <Text style={styles.sectionLabel}>Join Table</Text>
        <View style={styles.joinRow}>
          <TextInput
            placeholder="Enter table code"
            placeholderTextColor={palette.textMuted}
            style={styles.joinInput}
            value={joinCode}
            onChangeText={setJoinCode}
          />
          <TouchableOpacity style={styles.joinButton} activeOpacity={0.85} onPress={handleJoin}>
            <Text style={styles.joinButtonText}>Join</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.createRow}>
          <TextInput
            placeholder="New table name"
            placeholderTextColor={palette.textMuted}
            style={styles.joinInput}
            value={tableName}
            onChangeText={setTableName}
          />
          <TouchableOpacity style={styles.createButton} activeOpacity={0.85} onPress={handleCreate}>
            <MaterialIcons name="add-box" size={18} color={palette.tertiary} />
            <Text style={styles.createButtonText}>Create</Text>
          </TouchableOpacity>
        </View>
      </View>

      {roomStats.map((room) => {
        const total = room.wins + room.losses + room.middle;
        const winPct = total ? Math.round((room.wins / total) * 100) : 0;
        const lossPct = total ? Math.round((room.losses / total) * 100) : 0;
        const middlePct = total ? Math.max(0, 100 - winPct - lossPct) : 0;

        return (
          <View key={room.id} style={styles.roomCard}>
            <View style={styles.roomHeader}>
              <View>
                <Text style={styles.roomTitle}>{room.name}</Text>
                <Text style={styles.roomCode}>Table Code • {room.code}</Text>
              </View>
              <View style={styles.roomBadge}>
                <Text style={styles.roomBadgeLabel}>Win %</Text>
                <Text style={styles.roomBadgeValue}>{winPct}%</Text>
              </View>
            </View>
            <View style={styles.roomTotals}>
              <View>
                <Text style={styles.roomTotalLabel}>Wins</Text>
                <Text style={[styles.roomTotalValue, { color: palette.primary }]}>{room.wins}</Text>
              </View>
              <View>
                <Text style={styles.roomTotalLabel}>Middle</Text>
                <Text style={[styles.roomTotalValue, { color: palette.tertiary }]}>{room.middle}</Text>
              </View>
              <View>
                <Text style={styles.roomTotalLabel}>Losses</Text>
                <Text style={[styles.roomTotalValue, { color: palette.secondary }]}>{room.losses}</Text>
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
            <View style={styles.leaderboardHeader}>
              <Text style={styles.leaderboardLabel}>Player</Text>
              <Text style={styles.leaderboardLabel}>Win%</Text>
              <Text style={styles.leaderboardLabel}>Loss%</Text>
              <Text style={styles.leaderboardLabel}>Mid%</Text>
            </View>
            {room.players.map((player, index) => (
              <View key={player.id} style={styles.leaderboardRow}>
                <View style={styles.leaderboardNameWrap}>
                  <Text style={styles.leaderboardRank}>#{index + 1}</Text>
                  <Text style={styles.leaderboardName}>{player.name}</Text>
                </View>
                <Text style={[styles.leaderboardValue, { color: palette.primary }]}>{player.winPct}%</Text>
                <Text style={[styles.leaderboardValue, { color: palette.secondary }]}>{player.lossPct}%</Text>
                <Text style={[styles.leaderboardValue, { color: palette.tertiary }]}>{player.middlePct}%</Text>
              </View>
            ))}
          </View>
        );
      })}
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
  sectionLabel: {
    color: palette.textMuted,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  joinCard: {
    backgroundColor: palette.surfaceLow,
    borderRadius: 20,
    padding: 18,
    gap: 12,
  },
  joinRow: {
    flexDirection: 'row',
    gap: 10,
  },
  createRow: {
    flexDirection: 'row',
    gap: 10,
  },
  joinInput: {
    flex: 1,
    backgroundColor: palette.surface,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: palette.text,
    fontSize: 12,
  },
  joinButton: {
    backgroundColor: palette.primary,
    borderRadius: 14,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  joinButtonText: {
    color: '#00440a',
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontFamily: Fonts.rounded,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    backgroundColor: palette.surface,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  createButtonText: {
    color: palette.text,
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  roomCard: {
    backgroundColor: palette.surfaceLow,
    borderRadius: 22,
    padding: 18,
    gap: 12,
  },
  roomHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roomTitle: {
    color: palette.text,
    fontFamily: Fonts.rounded,
    fontSize: 18,
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
  leaderboardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  leaderboardLabel: {
    color: palette.textMuted,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    flex: 1,
    textAlign: 'right',
  },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: palette.surface,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  leaderboardNameWrap: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  leaderboardRank: {
    color: palette.textMuted,
    fontSize: 12,
  },
  leaderboardName: {
    color: palette.text,
    fontFamily: Fonts.rounded,
    fontSize: 14,
  },
  leaderboardValue: {
    flex: 1,
    textAlign: 'right',
    fontFamily: Fonts.rounded,
    fontSize: 12,
  },
});
