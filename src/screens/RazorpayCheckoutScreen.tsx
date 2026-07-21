import React, { useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import Icon from 'react-native-vector-icons/Ionicons';
import { monetizationApi } from '../services/api/monetization';
import { useEntitlements } from '../context/EntitlementContext';

type Props = {
  onBack?: () => void;
  planId: string;
  period: 'MONTHLY' | 'SEMIANNUAL' | 'YEARLY';
  planName?: string;
  amountPaise?: number;
  orderId: string;
  keyId: string;
  currency?: string;
  prefillEmail?: string;
  prefillName?: string;
};

/**
 * Razorpay Checkout via WebView. On success, verifies signature with the server
 * before activating any subscription entitlement.
 */
export default function RazorpayCheckoutScreen({
  onBack,
  planId,
  period,
  planName,
  amountPaise,
  orderId,
  keyId,
  currency = 'INR',
  prefillEmail,
  prefillName,
}: Props) {
  const { refreshEntitlements } = useEntitlements();
  const [busy, setBusy] = useState(false);
  const handled = useRef(false);

  const html = useMemo(() => {
    const amount = amountPaise ?? 0;
    const name = (planName || 'PalSafar Subscription').replace(/'/g, "\\'");
    const email = (prefillEmail || '').replace(/'/g, "\\'");
    const displayName = (prefillName || '').replace(/'/g, "\\'");
    return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
</head><body style="font-family:sans-serif;background:#FFF9F2;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
<p id="status" style="color:#63300E;font-weight:700">Opening secure checkout…</p>
<script>
var options = {
  key: ${JSON.stringify(keyId)},
  amount: ${amount},
  currency: ${JSON.stringify(currency)},
  name: 'PalSafar',
  description: ${JSON.stringify(name)},
  order_id: ${JSON.stringify(orderId)},
  prefill: { email: ${JSON.stringify(email)}, name: ${JSON.stringify(displayName)} },
  theme: { color: '#B9834B' },
  handler: function (response) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'success', response: response }));
  },
  modal: {
    ondismiss: function () {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'dismiss' }));
    }
  }
};
var rzp = new Razorpay(options);
rzp.on('payment.failed', function (resp) {
  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'failed', response: resp }));
});
rzp.open();
</script></body></html>`;
  }, [amountPaise, currency, keyId, orderId, planName, prefillEmail, prefillName]);

  const onMessage = async (event: any) => {
    if (handled.current || busy) return;
    let payload: any;
    try {
      payload = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }

    if (payload.type === 'dismiss') {
      onBack?.();
      return;
    }
    if (payload.type === 'failed') {
      Alert.alert('Payment failed', payload.response?.error?.description || 'Please try again');
      return;
    }
    if (payload.type !== 'success') return;

    handled.current = true;
    setBusy(true);
    try {
      const r = payload.response || {};
      await monetizationApi.verifyRazorpayPayment({
        razorpayOrderId: r.razorpay_order_id,
        razorpayPaymentId: r.razorpay_payment_id,
        razorpaySignature: r.razorpay_signature,
        planId,
        period,
      });
      await refreshEntitlements();
      Alert.alert('Subscription active', 'Payment verified. Your plan is now active.', [
        { text: 'OK', onPress: () => onBack?.() },
      ]);
    } catch (e: any) {
      handled.current = false;
      Alert.alert('Verification failed', e?.message || 'Server could not verify payment');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.back}>
          <Icon name="close" size={22} color="#63300E" />
        </TouchableOpacity>
        <Text style={styles.title}>Secure checkout</Text>
        <View style={{ width: 40 }} />
      </View>
      {busy ? (
        <View style={styles.center}>
          <ActivityIndicator color="#B9834B" />
          <Text style={styles.hint}>Verifying payment with PalSafar…</Text>
        </View>
      ) : (
        <WebView
          originWhitelist={['*']}
          source={{ html }}
          onMessage={onMessage}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF9F2' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontWeight: '800', color: '#63300E', fontSize: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  hint: { color: '#8B7355', fontWeight: '600' },
});
