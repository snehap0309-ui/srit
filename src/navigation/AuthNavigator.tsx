import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthStackParamList } from './types';
import { useTheme } from '../context/ThemeContext';
import { useUserContext } from '../context/UserContext';
import { useLazyScreen } from '../utils/useLazyScreen';

const Stack = createNativeStackNavigator<AuthStackParamList>();

function LoginSplashWrapper({ navigation }: any) {
  const Screen = useLazyScreen(() => require('../screens/LoginSplashScreen'));
  return <Screen navigation={navigation} />;
}

function LoginWrapper({ navigation }: any) {
  const { onLogin, onGuestContinue, authLoading } = useUserContext();
  const Screen = useLazyScreen(() => require('../screens/auth/LoginScreen'));

  return (
    <Screen
      onLogin={onLogin}
      onSignup={() => navigation.navigate('Signup')}
      onForgotPassword={() => navigation.navigate('ForgotPassword')}
      onGuestContinue={onGuestContinue}
      isLoading={authLoading}
    />
  );
}

function SignupWrapper({ navigation }: any) {
  const { onSignup, onGuestContinue, authLoading } = useUserContext();
  const Screen = useLazyScreen(() => require('../screens/auth/SignupScreen'));
  return (
    <Screen
      onSignup={onSignup}
      onLogin={() => navigation.navigate('Login')}
      onGuestContinue={onGuestContinue}
      isLoading={authLoading}
    />
  );
}

function ForgotPasswordWrapper({ navigation }: any) {
  const { onForgotPassword } = useUserContext();
  const Screen = useLazyScreen(() => require('../screens/auth/ForgotPasswordScreen'));
  return (
    <Screen
      onBack={() => navigation.goBack()}
      onResetPassword={onForgotPassword}
    />
  );
}

export default function AuthNavigator({ initialRoute }: { initialRoute?: string }) {
  const { theme } = useTheme();

  return (
    <Stack.Navigator
      initialRouteName={(initialRoute || 'Login') as keyof AuthStackParamList}
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="LoginSplash" component={LoginSplashWrapper} />
      <Stack.Screen name="Login" component={LoginWrapper} />
      <Stack.Screen name="Signup" component={SignupWrapper} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordWrapper} />
    </Stack.Navigator>
  );
}
