import { createContext, useContext } from 'react';

import {
  getProfile,
  profileExists,
  type BusinessProfile,
} from './repositories/profile';
import { useLiveQuery } from './live';

type ProfileState = { profile: BusinessProfile; onboarded: boolean };

const ProfileContext = createContext<ProfileState | null>(null);

/** Loads the business profile once and keeps it fresh after every write. */
export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { data } = useLiveQuery(
    async db => ({
      profile: await getProfile(db),
      onboarded: await profileExists(db),
    }),
    [],
  );
  if (!data) {
    return null;
  }
  return (
    <ProfileContext.Provider value={data}>{children}</ProfileContext.Provider>
  );
}

export function useProfile(): ProfileState {
  const value = useContext(ProfileContext);
  if (!value) {
    throw new Error('useProfile must be used inside ProfileProvider');
  }
  return value;
}
