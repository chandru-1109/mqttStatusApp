import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, ScrollView, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import mqtt from 'mqtt';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  const [ip, setIp] = useState('');
  const [topic, setTopic] = useState('status');
  const [connected, setConnected] = useState(false);
  const [statusLog, setStatusLog] = useState([]);
  const clientRef = useRef(null);
  const [permissionGranted, setPermissionGranted] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      setPermissionGranted(status === 'granted');
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Local notifications will not be shown.');
      }
    })();
  }, []);

  const log = (message) => {
    setStatusLog((logs) => [...logs, message]);
  };

  const sendLocalNotification = async (message) => {
    if (!permissionGranted) {
      Alert.alert('Notification', message);
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🚨 Device Offline',
        body: message,
      },
      trigger: null, // Immediate
    });
  };

  const connectToMQTT = () => {
    if (!ip || !topic) {
      Alert.alert('Error', 'Please enter both IP address and topic');
      return;
    }

    const brokerUrl = `ws://${ip}:9001/mqtt`;
    const client = mqtt.connect(brokerUrl);

    clientRef.current = client;

    client.on('connect', () => {
      setConnected(true);
      log(`✅ Connected to ${brokerUrl}`);

      client.subscribe(topic, (err) => {
        if (!err) {
          log(`📡 Subscribed to "${topic}"`);
        } else {
          log(`❌ Subscription failed: ${err.message}`);
        }
      });
    });

    client.on('message', (topic, message) => {
      const msg = message.toString();
      log(`📩 ${topic}: ${msg}`);

      try {
        const data = JSON.parse(msg);
        if (data.status === 'offline') {
          const stationId = data.stationId || 'Unknown Station';
          sendLocalNotification(`Device "${stationId}" is offline`);
          log(`🚨 "${stationId}" is offline`);
        }
      } catch (e) {
        log(`⚠️ Invalid message format: ${msg}`);
      }
    });

    client.on('error', (err) => {
      log(`❌ MQTT Error: ${err.message}`);
    });

    client.on('close', () => {
      setConnected(false);
      log(`🔌 Disconnected from ${brokerUrl}`);
    });
  };

  const resetConnection = () => {
    if (clientRef.current) {
      clientRef.current.end();
      clientRef.current = null;
    }
    setConnected(false);
    setStatusLog([]);
    setIp('');
    setTopic('mqtt/status');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>📡 MQTT Status Monitor</Text>

      <TextInput
        style={styles.input}
        placeholder="Enter IP (e.g., 192.168.1.6)"
        value={ip}
        onChangeText={setIp}
        keyboardType="numeric"
      />

      <TextInput
        style={styles.input}
        placeholder="Enter topic (e.g., status)"
        value={topic}
        onChangeText={setTopic}
      />

      <View style={styles.buttonGroup}>
        <Button title="Connect" onPress={connectToMQTT} disabled={connected} />
        <Button title="Disconnect" onPress={resetConnection} color="red" />
      </View>

      <ScrollView style={styles.logBox}>
        {statusLog.map((log, index) => (
          <Text key={index} style={styles.logText}>{log}</Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingTop: 60,
    flex: 1,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  input: {
    borderColor: '#aaa',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  buttonGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  logBox: {
    flex: 1,
    marginTop: 10,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#f9f9f9',
  },
  logText: {
    fontSize: 14,
    marginBottom: 5,
  },
});
