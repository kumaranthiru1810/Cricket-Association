import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const DOMAINS = ['@gmail.com', '@yahoo.com', '@outlook.com', '@hotmail.com'];

interface EmailDomainSuggestionsProps {
  value: string;
  onSelectDomain: (completedEmail: string) => void;
  style?: any;
}

export const EmailDomainSuggestions: React.FC<EmailDomainSuggestionsProps> = React.memo(
  ({ value, onSelectDomain, style }) => {
    if (!value || typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (trimmed.length < 1) return null;

    const atIndex = trimmed.indexOf('@');
    if (atIndex !== -1) {
      const afterAt = trimmed.slice(atIndex); // e.g. "@", "@g", "@gmail.com"
      // If already has a dot with extension (e.g. .com, .org, .in, .net), don't show
      if (afterAt.includes('.') && afterAt.length > 4) {
        return null;
      }
    }

    const prefix = atIndex !== -1 ? trimmed.slice(0, atIndex) : trimmed;
    if (!prefix) return null;

    const domainPart = atIndex !== -1 ? trimmed.slice(atIndex).toLowerCase() : '@';

    const matching = DOMAINS.filter((d) =>
      d.startsWith(domainPart) || domainPart === '@'
    );

    if (matching.length === 0) return null;

    return (
      <View style={[styles.container, style]}>
        <Text style={styles.hintText}>Quick add:</Text>
        <View style={styles.chipsRow}>
          {matching.map((dom) => {
            const isGmail = dom === '@gmail.com';
            return (
              <TouchableOpacity
                key={dom}
                style={[styles.chip, isGmail ? styles.chipGmail : styles.chipOther]}
                onPress={() => {
                  const completed = `${prefix}${dom}`;
                  onSelectDomain(completed);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, isGmail ? styles.chipTextGmail : styles.chipTextOther]}>
                  {dom}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  }
);

EmailDomainSuggestions.displayName = 'EmailDomainSuggestions';

export default EmailDomainSuggestions;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
    marginBottom: 4,
  },
  hintText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    marginRight: 2,
  },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipGmail: {
    backgroundColor: '#eff6ff',
    borderWidth: 1.5,
    borderColor: '#3b82f6',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 1,
  },
  chipOther: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  chipText: {
    fontSize: 12,
  },
  chipTextGmail: {
    fontWeight: '700',
    color: '#1d4ed8',
  },
  chipTextOther: {
    fontWeight: '600',
    color: '#475569',
  },
});

