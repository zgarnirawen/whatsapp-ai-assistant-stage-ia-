import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type QuickAction = {
  id: string;
  label: string;
  prompt: string;
};

const ACTIONS: QuickAction[] = [
  { id: 'create-task', label: 'Créer une tâche', prompt: 'Créer une tâche' },
  { id: 'view-calendar', label: 'Voir mon agenda', prompt: 'Voir mon agenda' },
  { id: 'create-event', label: 'Créer un rendez-vous', prompt: 'Créer un rendez-vous' },
  { id: 'summary', label: 'Résumer ma semaine', prompt: 'Résumer ma semaine' },
];

type Props = {
  language?: 'fr' | 'en';
  onSelect: (prompt: string) => void;
};

export default function QuickActionShortcuts({ language = 'fr', onSelect }: Props) {
  const actions = language === 'en'
    ? [
        { id: 'create-task', label: 'Create a task', prompt: 'Create a task' },
        { id: 'view-calendar', label: 'View my calendar', prompt: 'Show my calendar' },
        { id: 'create-event', label: 'Create an appointment', prompt: 'Create an appointment' },
        { id: 'summary', label: 'Summarize my week', prompt: 'Summarize my week' },
      ]
    : ACTIONS;

  return (
    <View style={styles.container} accessibilityRole="menu">
      <Text style={styles.title}>
        {language === 'en' ? 'You can also try:' : 'Vous pouvez aussi essayer :'}
      </Text>
      <View style={styles.list}>
        {actions.map((action) => (
          <Pressable
            key={action.id}
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            onPress={() => onSelect(action.prompt)}
            accessibilityRole="button"
            accessibilityLabel={action.label}
          >
            <Text style={styles.buttonText}>{action.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  title: {
    marginBottom: 8,
    fontSize: 13,
    color: '#667085',
  },
  list: {
    gap: 8,
  },
  button: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: '#fff',
  },
  pressed: {
    opacity: 0.7,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4338ca',
  },
});
