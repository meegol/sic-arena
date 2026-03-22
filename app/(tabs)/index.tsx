import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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

type MatchResult = {
  room_id: string;
  user_id: string;
  result: 'win' | 'loss' | 'middle';
};

type RoomMember = {
  room_id: string;
  user_id: string;
  display_name: string | null;
};

export default function DashboardScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [results, setResults] = useState<MatchResult[]>([]);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert('Sign out failed', error.message);
      return;
    }
    router.replace('/(auth)/login' as const);
  };

  useEffect(() => {
    const loadDashboard = async () => {
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
          name: room.name ?? 'Unnamed Room',
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
          .select('room_id, user_id, result')
          .in('room_id', roomIds.length ? roomIds : ['']),
      ]);

      setProfile(profileData ?? null);
      setRooms(roomList);
      setResults(resultsData ?? []);
      setMembers(memberData ?? []);
      setUserId(userData.user.id);
      setLoading(false);
    };

    loadDashboard();
  }, []);

  const totals = useMemo(() => {
    return results
      .filter((item) => item.user_id === userId)
      .reduce(
        (acc, item) => {
          if (item.result === 'win') acc.wins += 1;
          if (item.result === 'loss') acc.losses += 1;
          if (item.result === 'middle') acc.middle += 1;
          acc.total += 1;
          return acc;
        },
        { wins: 0, losses: 0, middle: 0, total: 0 }
      );
  }, [results, userId]);

  const totalGames = totals.total;
  const winPct = totalGames ? Math.round((totals.wins / totalGames) * 100) : 0;
  const lossPct = totalGames ? Math.round((totals.losses / totalGames) * 100) : 0;
  const middlePct = totalGames ? Math.max(0, 100 - winPct - lossPct) : 0;

  const roomStats = useMemo(() => {
    return rooms.map((room) => {
      const roomResults = results.filter((item) => item.room_id === room.id);
      const stats = roomResults.reduce(
        (acc, item) => {
          if (item.result === 'win') acc.wins += 1;
          if (item.result === 'loss') acc.losses += 1;
          if (item.result === 'middle') acc.middle += 1;
          acc.total += 1;
          return acc;
        },
        { wins: 0, losses: 0, middle: 0, total: 0 }
      );

      return { ...room, ...stats };
    });
  }, [rooms, results]);

  const leaderboard = useMemo(() => {
    const activeRoom = rooms[0];
    if (!activeRoom) return [];

    const entries = members
      .filter((member) => member.room_id === activeRoom.id)
      .map((member) => {
        const memberResults = results.filter((item) => item.room_id === activeRoom.id && item.user_id === member.user_id);
        const stats = memberResults.reduce(
          (acc, item) => {
            if (item.result === 'win') acc.wins += 1;
            if (item.result === 'loss') acc.losses += 1;
            if (item.result === 'middle') acc.middle += 1;
            acc.total += 1;
            return acc;
          },
          { wins: 0, losses: 0, middle: 0, total: 0 }
        );

        const total = stats.total;
        const winPct = total ? Math.round((stats.wins / total) * 100) : 0;
        const lossPct = total ? Math.round((stats.losses / total) * 100) : 0;
        const middlePct = total ? Math.max(0, 100 - winPct - lossPct) : 0;
        return {
          id: member.user_id,
          name: member.display_name ?? 'Player',
          winPct,
          lossPct,
          middlePct,
        };
      });

    return entries.sort((a, b) => b.winPct - a.winPct);
  }, [rooms, members, results]);

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
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>SIC</Text>
          </View>
          <View>
            <Text style={styles.brand}>SIC Arena</Text>
            <Text style={styles.subtitle}>Pusoy Dos Tracker</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconButton} activeOpacity={0.8}>
              <MaterialIcons name="settings" size={22} color={palette.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} activeOpacity={0.8} onPress={handleSignOut}>
              <MaterialIcons name="logout" size={20} color={palette.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

      <View style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View>
            <Text style={styles.sectionLabel}>Welcome back</Text>
            <Text style={styles.heroName}>{profile?.display_name ?? 'Player'}</Text>
          </View>
          <View style={styles.rankBadge}>
            <Text style={styles.rankLabel}>Tables</Text>
            <Text style={styles.rankValue}>{rooms.length}</Text>
          </View>
        </View>
        <View style={styles.heroStatsRow}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{totals.total}</Text>
            <Text style={styles.heroStatLabel}>Total Games</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={[styles.heroStatValue, { color: palette.primary }]}>{winPct}%</Text>
            <Text style={styles.heroStatLabel}>Win %</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={[styles.heroStatValue, { color: palette.secondary }]}>{lossPct}%</Text>
            <Text style={styles.heroStatLabel}>Loss %</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={[styles.heroStatValue, { color: palette.tertiary }]}>{middlePct}%</Text>
            <Text style={styles.heroStatLabel}>Middle %</Text>
          </View>
        </View>
        <View style={styles.heroDivider} />
        <View style={styles.heroTotals}>
          <View>
            <Text style={styles.heroTotalLabel}>Wins</Text>
            <Text style={[styles.heroTotalValue, { color: palette.primary }]}>{totals.wins}</Text>
          </View>
          <View>
            <Text style={styles.heroTotalLabel}>Middle</Text>
            <Text style={[styles.heroTotalValue, { color: palette.tertiary }]}>{totals.middle}</Text>
          </View>
          <View>
            <Text style={styles.heroTotalLabel}>Losses</Text>
            <Text style={[styles.heroTotalValue, { color: palette.secondary }]}>{totals.losses}</Text>
          </View>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Table Performance</Text>
          <Text style={styles.sectionSubtitle}>Win/Loss/Middle tracked per table.</Text>
        </View>
        <TouchableOpacity style={styles.sectionAction} activeOpacity={0.8}>
          <Text style={styles.sectionActionText}>View All</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.roomList}>
        {roomStats.map((room) => {
          const total = room.wins + room.losses + room.middle;
          const roomWin = total ? Math.round((room.wins / total) * 100) : 0;
          const roomLoss = total ? Math.round((room.losses / total) * 100) : 0;
          const roomMiddle = total ? Math.max(0, 100 - roomWin - roomLoss) : 0;

          return (
            <View key={room.id} style={styles.roomCard}>
              <View style={styles.roomHeader}>
                <View>
                  <Text style={styles.roomName}>{room.name}</Text>
                  <Text style={styles.roomSub}>Table Code • {room.code}</Text>
                </View>
                <View style={styles.roomBadge}>
                  <Text style={styles.roomBadgeLabel}>Win %</Text>
                  <Text style={styles.roomBadgeValue}>{roomWin}%</Text>
                </View>
              </View>
              <View style={styles.roomMetrics}>
                <View>
                  <Text style={styles.roomMetricLabel}>Wins</Text>
                  <Text style={[styles.roomMetricValue, { color: palette.primary }]}>{room.wins}</Text>
                </View>
                <View>
                  <Text style={styles.roomMetricLabel}>Middle</Text>
                  <Text style={[styles.roomMetricValue, { color: palette.tertiary }]}>{room.middle}</Text>
                </View>
                <View>
                  <Text style={styles.roomMetricLabel}>Losses</Text>
                  <Text style={[styles.roomMetricValue, { color: palette.secondary }]}>{room.losses}</Text>
                </View>
                <View>
                  <Text style={styles.roomMetricLabel}>Loss %</Text>
                  <Text style={[styles.roomMetricValue, { color: palette.secondary }]}>{roomLoss}%</Text>
                </View>
                <View>
                  <Text style={styles.roomMetricLabel}>Middle %</Text>
                  <Text style={[styles.roomMetricValue, { color: palette.tertiary }]}>{roomMiddle}%</Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Table Rankings</Text>
          <Text style={styles.sectionSubtitle}>Top players by win rate.</Text>
        </View>
      </View>
      <View style={styles.leaderboardCard}>
        <View style={styles.leaderboardHeader}>
          <Text style={styles.leaderboardLabel}>Player</Text>
          <Text style={styles.leaderboardLabel}>Win%</Text>
          <Text style={styles.leaderboardLabel}>Loss%</Text>
          <Text style={styles.leaderboardLabel}>Mid%</Text>
        </View>
        {leaderboard.map((leader, index) => (
          <View key={leader.id} style={styles.leaderboardRow}>
            <View style={styles.leaderboardNameWrap}>
              <Text style={styles.leaderboardRank}>#{index + 1}</Text>
              <Text style={styles.leaderboardName}>{leader.name}</Text>
            </View>
            <Text style={[styles.leaderboardValue, { color: palette.primary }]}>{leader.winPct}%</Text>
            <Text style={[styles.leaderboardValue, { color: palette.secondary }]}>{leader.lossPct}%</Text>
            <Text style={[styles.leaderboardValue, { color: palette.tertiary }]}>{leader.middlePct}%</Text>
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
    gap: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: palette.surfaceHigh,
    borderWidth: 1,
    borderColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: palette.primary,
    fontSize: 12,
    fontFamily: Fonts.rounded,
    letterSpacing: 2,
  },
  brand: {
    color: palette.primary,
    fontSize: 20,
    fontFamily: Fonts.rounded,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  subtitle: {
    color: palette.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: 2,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActions: {
    marginLeft: 'auto',
    flexDirection: 'row',
    gap: 10,
  },
  heroCard: {
    backgroundColor: palette.surfaceLow,
    borderRadius: 24,
    padding: 20,
    gap: 16,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionLabel: {
    color: palette.textMuted,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  heroName: {
    color: palette.text,
    fontSize: 28,
    fontFamily: Fonts.rounded,
    marginTop: 4,
  },
  rankBadge: {
    backgroundColor: palette.surfaceHigh,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  rankLabel: {
    color: palette.textMuted,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  rankValue: {
    color: palette.primary,
    fontSize: 16,
    fontFamily: Fonts.rounded,
    marginTop: 2,
  },
  heroStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  heroStat: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    minWidth: '45%',
  },
  heroStatValue: {
    fontSize: 22,
    fontFamily: Fonts.rounded,
    color: palette.text,
  },
  heroStatLabel: {
    color: palette.textMuted,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  heroDivider: {
    height: 1,
    backgroundColor: 'rgba(70, 71, 82, 0.25)',
  },
  heroTotals: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroTotalLabel: {
    color: palette.textMuted,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  heroTotalValue: {
    fontSize: 20,
    fontFamily: Fonts.rounded,
    marginTop: 6,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 16,
  },
  sectionTitle: {
    color: palette.text,
    fontSize: 20,
    fontFamily: Fonts.rounded,
    textTransform: 'uppercase',
  },
  sectionSubtitle: {
    color: palette.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  sectionAction: {
    backgroundColor: palette.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sectionActionText: {
    color: palette.textMuted,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  roomList: {
    gap: 12,
  },
  roomCard: {
    backgroundColor: palette.surfaceLow,
    borderRadius: 20,
    padding: 18,
    gap: 12,
  },
  roomHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  roomName: {
    color: palette.text,
    fontSize: 16,
    fontFamily: Fonts.rounded,
  },
  roomSub: {
    color: palette.textMuted,
    fontSize: 10,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  roomMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  roomMetricLabel: {
    color: palette.textMuted,
    fontSize: 9,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  roomMetricValue: {
    color: palette.text,
    fontSize: 16,
    fontFamily: Fonts.rounded,
  },
  leaderboardCard: {
    backgroundColor: palette.surfaceLow,
    borderRadius: 20,
    padding: 18,
    gap: 12,
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
