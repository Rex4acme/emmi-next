'use client';
// hooks/useFaultReminder.ts — 7am Fault Reminder Hook
// On page load (after sign-in), this hook:
//   1. Checks if it is between 7:00am and 9:00am
//   2. Queries for faults logged before midnight that are still unresolved
//   3. Shows a browser notification + in-app toast for each one
//   4. Marks them as reminder_sent so they don't fire again today
//
// Browser notifications require the user to grant permission.
// The in-app toast shows regardless of notification permission.

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { getUnresolvedFaultsSince, markReminderSent } from '@/lib/db';
import type { Fault } from '@/types';

interface ReminderState {
  faults:  Fault[];         // Faults needing attention
  visible: boolean;         // Whether the reminder banner is showing
  dismiss: () => void;      // Hide the banner
}

export function useFaultReminder(userId: string | null): ReminderState {
  const supabase = createBrowserClient();
  const [faults,  setFaults]  = useState<Fault[]>([]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!userId) return; // not signed in — skip
    const safeUserId: string = userId;

    async function checkReminders() {
      const now  = new Date();
      const hour = now.getHours();

      // Only show reminders between 7am and 9am
      // Outside these hours, faults are still queryable but no pop-up
      if (hour < 7 || hour >= 9) return;

      // "Since midnight" — any fault detected before today at 00:00
      const midnight = new Date();
      midnight.setHours(0, 0, 0, 0); // today at 00:00:00

      // Query for open faults that haven't had a reminder sent yet
      const unresolvedFaults = await getUnresolvedFaultsSince(
        supabase,
        safeUserId,
        midnight.toISOString()
      );

      if (unresolvedFaults.length === 0) return; // nothing to remind about

      // Store the faults and show the banner
      setFaults(unresolvedFaults as Fault[]);
      setVisible(true);

      // ── Browser Push Notification ──────────────────────────
      // Request permission if not already granted
      if ('Notification' in window) {
        let permission = Notification.permission;

        if (permission === 'default') {
          // Ask user for permission (shows browser prompt)
          permission = await Notification.requestPermission();
        }

        if (permission === 'granted') {
          // Fire one notification per unresolved fault
          unresolvedFaults.forEach(fault => {
            new Notification('⚡ EMMI — Unresolved Fault', {
              body: `"${fault.title}" — ${fault.severity.toUpperCase()} severity · Still unresolved`,
              icon: '/icons/icon-192.png', // App icon for notification
              tag:  `fault-${fault.id}`,   // Prevents duplicate notifications
            });
          });
        }
      }

      // ── Mark reminders as sent ────────────────────────────
      // Do this after showing notifications so they don't repeat
      await Promise.all(
        unresolvedFaults.map(f => markReminderSent(supabase, f.id))
      );
    }

    checkReminders();
  }, [userId]); // only run when userId changes (i.e. on login)

  function dismiss() {
    setVisible(false);
  }

  return { faults, visible, dismiss };
}
