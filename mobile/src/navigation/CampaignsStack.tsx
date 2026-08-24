import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import CampaignsScreen from '../screens/main/CampaignsScreen';
import CampaignDetailScreen from '../screens/main/CampaignDetailScreen';
import CampaignCreateScreen from '../screens/main/CampaignCreateScreen';

const Stack = createNativeStackNavigator();

export default function CampaignsStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.textPrimary,
      }}
    >
      <Stack.Screen name="CampaignsList" component={CampaignsScreen} options={{ title: 'Campaigns' }} />
      <Stack.Screen name="CampaignCreate" component={CampaignCreateScreen} options={{ title: 'New Campaign' }} />
      <Stack.Screen
        name="CampaignDetail"
        component={CampaignDetailScreen}
        options={({ route }: any) => ({ title: route.params?.name || 'Campaign' })}
      />
    </Stack.Navigator>
  );
}
