import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '@/lib/theme';

const ACTIVE = COLORS.accent;
const INACTIVE = '#BBBBBB';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACTIVE,
        tabBarInactiveTintColor: INACTIVE,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#F0F0F0',
          borderTopWidth: 1,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons name={focused ? 'home' : 'home-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="journeys"
        options={{
          title: 'Journeys',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="circle-double" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="sessions"
        options={{
          title: 'Sessions',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="clock-outline" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="integration"
        options={{
          title: 'Integration',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="notebook-outline" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="mirror"
        options={{
          title: 'Reflect',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="eye-outline" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
