import { create } from "zustand";
import { persist } from "zustand/middleware";
import { supabase } from "@/lib/supabase";

type ProfileState = {
  id: string | null;
  avatarUrl: string | null;
  fullName: string | null;
  email: string | null;
  setProfile: (profile: Partial<Pick<ProfileState, "id" | "avatarUrl" | "fullName" | "email">>) => void;
  resetProfile: () => void;
  refreshAvatarFromDb: () => Promise<void>;
};

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      id: null,
      avatarUrl: null,
      fullName: null,
      email: null,
      setProfile: (profile) =>
        set((state) => {
          // Safeguard: never override existing values with null/empty strings
          // Only update with non-empty values
          const safeProfile: Partial<typeof state> = {};
          
          if (profile.id !== undefined && profile.id !== null) {
            safeProfile.id = profile.id;
          }
if (profile.avatarUrl !== undefined) {
        if (profile.avatarUrl === null || !profile.avatarUrl.trim()) {
          safeProfile.avatarUrl = null;
        } else {
          safeProfile.avatarUrl = profile.avatarUrl;
        }
      }
      if (profile.fullName !== undefined) {
        safeProfile.fullName = profile.fullName;
      }
      if (profile.email !== undefined) {
            safeProfile.email = profile.email;
          }

          return {
            ...state,
            ...safeProfile,
          };
        }),
      resetProfile: () =>
        set({
          id: null,
          avatarUrl: null,
          fullName: null,
          email: null,
        }),
      // Refresh avatar from database after user edits profile
      refreshAvatarFromDb: async () => {
        try {
          const state = get();
          if (!state.id) return;

          const { data: profileData, error } = await supabase
            .from("profiles")
            .select("avatar_url")
            .eq("id", state.id)
            .maybeSingle();

          if (error) {
            console.debug("Error refreshing avatar:", error.message);
            return;
          }

          if (profileData) {
            set({ avatarUrl: profileData.avatar_url ?? null });
          }
        } catch (err) {
          console.debug("Error refreshing avatar from db:", err);
        }
      },
    }),
    {
      name: "profile-store",
      partialize: (state) => ({
        id: state.id,
        avatarUrl: state.avatarUrl,
        fullName: state.fullName,
        email: state.email,
      }),
      onRehydrateStorage: () => (state) => {
        // Called after state is rehydrated from localStorage
        // Ensure no null/empty values override valid cached data
        if (state) {
          if (!state.avatarUrl) {
            state.avatarUrl = null;
          }
        }
      },
    }
  )
);
