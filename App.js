import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator , TouchableOpacity } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Font from 'expo-font';
import { Ionicons } from '@expo/vector-icons';

import { AppProvider, useApp } from './src/state/AppContext';
import { colors } from './src/theme';
import { t } from './src/i18n/strings';

import AuthScreen from './src/screens/AuthScreen';
import VerifyEmailScreen from './src/screens/VerifyEmailScreen';
import AnonymousScreen from './src/screens/AnonymousScreen';
import FacultyReviewScreen from './src/screens/FacultyReviewScreen';
import { EducationBoardScreen, JobsScreen, SpotlightScreen } from './src/screens/CampusBoardsScreens';
import FindFriendsScreen from './src/screens/FindFriendsScreen';
import { AdminReportsScreen, DeveloperScreen, FeedbackScreen } from './src/screens/AdminExtrasScreens';
import FeedScreen from './src/screens/FeedScreen';
import CreatePostScreen from './src/screens/CreatePostScreen';
import CreateStoryScreen from './src/screens/CreateStoryScreen';
import StoryViewerScreen from './src/screens/StoryViewerScreen';
import DiscoverScreen from './src/screens/DiscoverScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import MyAccountScreen from './src/screens/MyAccountScreen';
import PublicProfileScreen from './src/screens/PublicProfileScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import MyEducationScreen from './src/screens/MyEducationScreen';
import CommentsScreen from './src/screens/CommentsScreen';
import UserProfileScreen from './src/screens/UserProfileScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import { ChatListScreen, ChatRoomScreen } from './src/screens/ChatScreens';
import {
  CampusHubScreen,
} from './src/screens/CampusScreens';
import {
  EventsScreen, LostFoundScreen, AlumniScreen, ClubsScreen, SeminarsScreen,
} from './src/screens/CampusExtraScreens';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const TAB_ICONS = {
  Feed: 'home',
  Discover: 'compass',
  Chats: 'chatbubbles',
  Campus: 'school',
  Profile: 'person-circle',
};

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.inkSoft,
        tabBarStyle: { borderTopColor: colors.line, backgroundColor: colors.surface },
        tabBarIcon: ({ color, focused, size }) => (
          <Ionicons
            name={focused ? TAB_ICONS[route.name] : `${TAB_ICONS[route.name]}-outline`}
            size={size}
            color={color}
          />
        ),
      })}
    >
      <Tab.Screen name="Feed" component={FeedScreen} options={{ tabBarLabel: t('feed') }} />
      <Tab.Screen name="Discover" component={DiscoverScreen} options={{ tabBarLabel: t('discover') }} />
      <Tab.Screen name="Chats" component={ChatListScreen} options={{ tabBarLabel: t('chats') }} />
      <Tab.Screen name="Campus" component={CampusHubScreen} options={{ tabBarLabel: t('campus') }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: t('profile') }} />
    </Tab.Navigator>
  );
}

function Root() {
  const { user, booting, banActive, signOut } = useApp();
  if (booting) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }
  if (!user) return <AuthScreen />;
  if (user.emailVerified === false) return <VerifyEmailScreen />;
  if (banActive) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.primaryDark, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Text style={{ fontSize: 44 }}>🚫</Text>
        <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 12, textAlign: 'center' }}>
          Account suspended
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, marginTop: 8, textAlign: 'center' }}>
          {user.bannedUntil === 'forever'
            ? 'This account has been permanently blocked for violating community rules.'
            : `This account is blocked until ${new Date(user.bannedUntil).toLocaleString()}.`}
        </Text>
        <TouchableOpacity
          onPress={signOut}
          style={{ marginTop: 24, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 999, paddingHorizontal: 24, paddingVertical: 12 }}
        >
          <Text style={{ color: '#fff', fontWeight: '800' }}>Sign out</Text>
        </TouchableOpacity>
      </View>
    );
  }
  return (
    <View style={{ flex: 1 }}>
      {user.anon?.on && (
        <View style={{
          backgroundColor: colors.anon,
          paddingTop: 34, paddingBottom: 6,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>
            {user.anon.emoji || '🎭'}  ANONYMOUS — appearing as {user.anon.name || 'Anonymous'}
          </Text>
        </View>
      )}
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={Tabs} />
      <Stack.Screen name="CreatePost" component={CreatePostScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="CreateStory" component={CreateStoryScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="StoryViewer" component={StoryViewerScreen} options={{ presentation: 'fullScreenModal' }} />
      <Stack.Screen name="ChatRoom" component={ChatRoomScreen} />
      <Stack.Screen name="Comments" component={CommentsScreen} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="MyAccount" component={MyAccountScreen} />
      <Stack.Screen name="PublicProfile" component={PublicProfileScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="AnonMode" component={AnonymousScreen} />
      <Stack.Screen name="MyEducation" component={MyEducationScreen} />
      <Stack.Screen name="Events" component={EventsScreen} />
      <Stack.Screen name="Clubs" component={ClubsScreen} />
      <Stack.Screen name="Seminars" component={SeminarsScreen} />
      <Stack.Screen name="LostFound" component={LostFoundScreen} />
      <Stack.Screen name="Alumni" component={AlumniScreen} />
      <Stack.Screen name="FacultyReview" component={FacultyReviewScreen} />
      <Stack.Screen name="Education" component={EducationBoardScreen} />
      <Stack.Screen name="Jobs" component={JobsScreen} />
      <Stack.Screen name="Spotlight" component={SpotlightScreen} />
      <Stack.Screen name="FindFriends" component={FindFriendsScreen} />
      <Stack.Screen name="AdminReports" component={AdminReportsScreen} />
      <Stack.Screen name="Developer" component={DeveloperScreen} />
      <Stack.Screen name="Feedback" component={FeedbackScreen} />
    </Stack.Navigator>
    </View>
  );
}

// Consumes uiTick so a theme/language change re-renders navigation,
// tab labels, background and status bar instantly.
function ThemedApp() {
  const { uiTick } = useApp();
  const navTheme = {
    ...DefaultTheme,
    dark: !!colors.dark,
    colors: {
      ...DefaultTheme.colors,
      background: colors.bg,
      card: colors.surface,
      text: colors.ink,
      border: colors.line,
      primary: colors.primary,
    },
  };
  return (
    <NavigationContainer theme={navTheme} key={`nav`}>
      <StatusBar style={colors.dark ? 'light' : 'dark'} />
      <Root />
    </NavigationContainer>
  );
}

export default function App() {
  // Preload the Ionicons font before rendering. On web the icon font isn't
  // guaranteed to be ready at first paint, which makes every icon show as an
  // empty box; waiting for it fixes that. On native it loads instantly.
  const [fontsReady, setFontsReady] = useState(false);

  useEffect(() => {
    let alive = true;
    Font.loadAsync(Ionicons.font)
      .catch(() => {})            // never block the app if the font call fails
      .finally(() => { if (alive) setFontsReady(true); });
    return () => { alive = false; };
  }, []);

  if (!fontsReady) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AppProvider>
        <ThemedApp />
      </AppProvider>
    </SafeAreaProvider>
  );
}
