import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { lookupISBN } from '@/src/services/isbn';

export default function BarcodeScannerModal() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission]);

  const handleBarcodeScanned = async ({ type, data }: BarcodeScanningResult) => {
    if (scanned || isLoading) return;

    // Check if it's an ISBN barcode (EAN-13 starting with 978/979 or ISBN-10)
    const isISBN = /^(978|979)\d{10}$/.test(data) || /^\d{10}$/.test(data);

    if (!isISBN) {
      setScanned(true);
      Alert.alert(
        'Invalid Barcode',
        'Please scan the ISBN barcode on the back of the book (usually starts with 978 or 979).',
        [{ text: 'Try Again', onPress: () => setScanned(false) }]
      );
      return;
    }

    setScanned(true);
    setIsLoading(true);

    try {
      const result = await lookupISBN(data);

      if (result.success && result.data) {
        // Navigate back with the scanned data
        router.dismiss();
        router.setParams({
          scannedData: JSON.stringify({
            isbn: data,
            ...result.data,
          }),
        });
      } else {
        Alert.alert(
          'Book Not Found',
          result.error || 'Could not find book information. Would you like to enter details manually?',
          [
            { text: 'Scan Again', onPress: () => setScanned(false) },
            {
              text: 'Enter Manually',
              onPress: () => {
                router.dismiss();
                router.setParams({ scannedIsbn: data });
              },
            },
          ]
        );
      }
    } catch (error) {
      Alert.alert(
        'Lookup Failed',
        'Failed to look up book information. Please try again.',
        [{ text: 'Try Again', onPress: () => setScanned(false) }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#F97316" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={64} color="#9CA3AF" />
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionText}>
            CookAI needs camera access to scan cookbook barcodes.
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelButton} onPress={() => router.dismiss()}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        enableTorch={torchEnabled}
        barcodeScannerSettings={{
          barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
      />

      {/* Overlay */}
      <View style={styles.overlay}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={() => router.dismiss()}>
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Scan ISBN Barcode</Text>
          <TouchableOpacity
            style={styles.torchButton}
            onPress={() => setTorchEnabled(!torchEnabled)}
          >
            <Ionicons
              name={torchEnabled ? 'flash' : 'flash-outline'}
              size={24}
              color="#FFFFFF"
            />
          </TouchableOpacity>
        </View>

        {/* Scan Area */}
        <View style={styles.scanArea}>
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />

          {isLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#F97316" />
              <Text style={styles.loadingText}>Looking up book...</Text>
            </View>
          )}
        </View>

        {/* Instructions */}
        <View style={styles.instructions}>
          <Text style={styles.instructionText}>
            Position the barcode within the frame
          </Text>
          <Text style={styles.subInstructionText}>
            Look for the ISBN barcode on the back cover
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  torchButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 40,
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#F97316',
  },
  topLeft: {
    top: '20%',
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 12,
  },
  topRight: {
    top: '20%',
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 12,
  },
  bottomLeft: {
    bottom: '20%',
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 12,
  },
  bottomRight: {
    bottom: '20%',
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 12,
  },
  loadingOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 16,
    padding: 24,
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginTop: 12,
  },
  instructions: {
    paddingHorizontal: 40,
    paddingBottom: 100,
    alignItems: 'center',
  },
  instructionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  subInstructionText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginTop: 8,
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: '#FFFFFF',
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 24,
    marginBottom: 12,
  },
  permissionText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  permissionButton: {
    backgroundColor: '#F97316',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    marginTop: 16,
    paddingVertical: 12,
  },
  cancelButtonText: {
    color: '#6B7280',
    fontSize: 16,
  },
});
