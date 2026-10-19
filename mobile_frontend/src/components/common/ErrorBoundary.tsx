import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.card}>
            <Text style={styles.icon}>⚠️</Text>
            <Text style={styles.title}>{this.props.fallbackTitle || 'Something went wrong'}</Text>
            <Text style={styles.message}>
              {this.state.error?.message || 'An unexpected rendering error occurred.'}
            </Text>

            {this.state.errorInfo && (
              <ScrollView style={styles.traceBox}>
                <Text style={styles.traceText}>
                  {this.state.error?.stack || this.state.errorInfo.componentStack}
                </Text>
              </ScrollView>
            )}

            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.primaryBtn} onPress={this.handleReset}>
                <Text style={styles.primaryBtnText}>Retry / Refresh</Text>
              </TouchableOpacity>
              {this.props.onReset && (
                <TouchableOpacity style={styles.secondaryBtn} onPress={this.props.onReset}>
                  <Text style={styles.secondaryBtnText}>Go Back</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0f1d',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  card: {
    backgroundColor: '#111e38',
    borderRadius: 16,
    padding: 24,
    maxWidth: 600,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(234, 179, 8, 0.4)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6
  },
  icon: {
    fontSize: 40,
    marginBottom: 12
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8
  },
  message: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 16
  },
  traceBox: {
    maxHeight: 140,
    width: '100%',
    backgroundColor: '#050a16',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16
  },
  traceText: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#f87171'
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8
  },
  primaryBtn: {
    backgroundColor: '#eab308',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8
  },
  primaryBtnText: {
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 13
  },
  secondaryBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)'
  },
  secondaryBtnText: {
    color: '#e2e8f0',
    fontWeight: '700',
    fontSize: 13
  }
});
