import { getDatabase } from '../db';
import { Settings, DarkModePreference, PayPeriodType } from '../../types';

function nowISO(): string {
  return new Date().toISOString();
}

export async function getSettings(userId: string): Promise<Settings | null> {
  const db = getDatabase();
  return db.getFirstAsync<Settings>(
    'SELECT * FROM settings WHERE user_id = ?',
    [userId]
  );
}

export async function updateSettings(
  userId: string,
  data: Partial<Omit<Settings, 'user_id' | 'updated_at'>>
): Promise<Settings> {
  const db = getDatabase();
  const now = nowISO();
  const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
  const values = [...Object.values(data), now, userId];

  await db.runAsync(
    `UPDATE settings SET ${fields}, updated_at = ? WHERE user_id = ?`,
    values
  );

  const updated = await getSettings(userId);
  if (!updated) throw new Error('Settings not found after update');
  return updated;
}

export async function setOnboardingComplete(userId: string): Promise<void> {
  await updateSettings(userId, { onboarding_complete: 1 });
}

export async function setDarkMode(userId: string, mode: DarkModePreference): Promise<void> {
  await updateSettings(userId, { dark_mode: mode });
}

export async function setPayPeriod(
  userId: string,
  type: PayPeriodType,
  startDay: number
): Promise<void> {
  await updateSettings(userId, { pay_period_type: type, pay_period_start_day: startDay });
}
