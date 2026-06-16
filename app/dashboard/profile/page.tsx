"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useProfileStore } from "@/hooks/useProfileStore";
import UserAddressCard from "@/components/user-profile/UserAddressCard";
import UserInfoCard from "@/components/user-profile/UserInfoCard";
import UserMetaCard from "@/components/user-profile/UserMetaCard";

type AppRole = "user" | "guru" | "admin";

type ProfileRow = {
  email: string | null;
  role: AppRole | null;
  created_at: string | null;
  affiliation: string | null;
  avatar_url?: string | null;
  certificate_name?: string | null;
  last_cert_name_update?: string | null;
};

type EditableProfile = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  bio: string;
  affiliation: string;
};

type EditableAddress = {
  country: string;
  cityState: string;
  postalCode: string;
  taxId: string;
};

const splitDisplayName = (fullName: string) => {
  const trimmedName = fullName.trim();

  if (!trimmedName) {
    return { firstName: "User", lastName: "" };
  }

  const parts = trimmedName.split(/\s+/);

  return {
    firstName: parts[0] ?? "User",
    lastName: parts.slice(1).join(" ") || "",
  };
};

const roleLabel = (role: AppRole | null | undefined) => {
  if (role === "admin") return "Admin";
  if (role === "guru") return "Coach";
  return "Student";
};

const getDisplayName = (user: {
  user_metadata?: {
    full_name?: string;
    name?: string;
    first_name?: string;
    last_name?: string;
  };
  email?: string | null;
}) => {
  const metadataName =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    [user.user_metadata?.first_name, user.user_metadata?.last_name]
      .filter(Boolean)
      .join(" ");

  return metadataName || user.email?.split("@")[0] || "User";
};

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const setProfileStore = useProfileStore((state) => state.setProfile);
  const [displayName, setDisplayName] = useState("User");
  const [editableProfile, setEditableProfile] = useState<EditableProfile>({
    firstName: "User",
    lastName: "",
    email: "-",
    phone: "-",
    bio: "-",
    affiliation: "-",
  });
  const [certificateName, setCertificateName] = useState<string>("");
  const [certificateNote, setCertificateNote] = useState<string>("");
  const [lastCertificateNameUpdate, setLastCertificateNameUpdate] = useState<string | null>(null);
  const [editableAddress, setEditableAddress] = useState<EditableAddress>({
    country: "-",
    cityState: "-",
    postalCode: "-",
    taxId: "-",
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const resolvedDisplayName = getDisplayName(user);
      setDisplayName(resolvedDisplayName);

      const parsedName = splitDisplayName(resolvedDisplayName);
      const metadataPhone =
        typeof user.user_metadata?.phone === "string" && user.user_metadata.phone.trim()
          ? user.user_metadata.phone
          : "-";
      const metadataBio =
        typeof user.user_metadata?.bio === "string" && user.user_metadata.bio.trim()
          ? user.user_metadata.bio
          : "-";
      const metadataAffiliation =
        typeof user.user_metadata?.affiliation === "string" && user.user_metadata.affiliation.trim()
          ? user.user_metadata.affiliation
          : "-";
      const metadataCountry =
        typeof user.user_metadata?.country === "string" && user.user_metadata.country.trim()
          ? user.user_metadata.country
          : "-";
      const metadataCityState =
        typeof user.user_metadata?.city_state === "string" && user.user_metadata.city_state.trim()
          ? user.user_metadata.city_state
          : "-";
      const metadataPostalCode =
        typeof user.user_metadata?.postal_code === "string" && user.user_metadata.postal_code.trim()
          ? user.user_metadata.postal_code
          : "-";
      const metadataTaxId =
        typeof user.user_metadata?.tax_id === "string" && user.user_metadata.tax_id.trim()
          ? user.user_metadata.tax_id
          : "-";

      setEditableProfile({
        firstName: parsedName.firstName,
        lastName: parsedName.lastName,
        email: user.email ?? "-",
        phone: metadataPhone,
        bio: metadataBio,
        affiliation: metadataAffiliation,
      });

      setEditableAddress({
        country: metadataCountry,
        cityState: metadataCityState,
        postalCode: metadataPostalCode,
        taxId: metadataTaxId,
      });

      const { data } = await supabase
        .from("profiles")
        .select("email, role, created_at, affiliation, avatar_url, certificate_name, last_cert_name_update")
        .eq("id", user.id)
        .maybeSingle();

      const profileData = (data as ProfileRow | null) ?? null;
      setProfile(profileData);
      setCertificateName(profileData?.certificate_name || "");
      setLastCertificateNameUpdate(profileData?.last_cert_name_update || null);
      if (profileData?.certificate_name) {
        setCertificateNote("Certificate name can be edited once per day.");
      }

      setProfileStore({
        id: user.id,
        fullName: resolvedDisplayName,
        email: user.email ?? null,
        avatarUrl: profileData?.avatar_url || null,
      });

      // Override with database affiliation if it exists (database is source of truth)
      if (profileData?.affiliation) {
        setEditableProfile((prev) => ({
          ...prev,
          affiliation: profileData.affiliation || "-",
        }));
      }

      setLoading(false);
    };

    void load();
  }, [router, setProfileStore]);

  const handleSaveUserInfo = async (values: EditableProfile & { certificateName: string }) => {
    const trimmedFirstName = values.firstName.trim();
    const trimmedLastName = values.lastName.trim();
    const trimmedCertificateName = values.certificateName.trim();
    const fullName = [trimmedFirstName, trimmedLastName].filter(Boolean).join(" ").trim();

    if (trimmedCertificateName !== certificateName) {
      // Enforce once per calendar day (server local day) on the client side as well.
      const lastUpdateDate = lastCertificateNameUpdate ? new Date(lastCertificateNameUpdate) : null;
      const now = new Date();
      if (
        lastUpdateDate &&
        lastUpdateDate.getFullYear() === now.getFullYear() &&
        lastUpdateDate.getMonth() === now.getMonth() &&
        lastUpdateDate.getDate() === now.getDate()
      ) {
        throw new Error("Certificate name can only be changed once per day.");
      }
    }

    const { error } = await supabase.auth.updateUser({
      data: {
        first_name: trimmedFirstName,
        last_name: trimmedLastName,
        full_name: fullName,
        name: fullName || trimmedFirstName,
        phone: values.phone.trim() || "-",
        bio: values.bio.trim() || "-",
        affiliation: values.affiliation.trim() || "",
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    // Update affiliation in profiles table
    const shouldUpdateCertificateTime = trimmedCertificateName !== certificateName;
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        affiliation: values.affiliation.trim() || null,
        certificate_name: trimmedCertificateName || null,
        last_cert_name_update: shouldUpdateCertificateTime ? new Date().toISOString() : lastCertificateNameUpdate,
      })
      .eq("id", (await supabase.auth.getUser()).data.user?.id);

    if (profileError) {
      throw new Error(`Failed to update affiliation: ${profileError.message}`);
    }

    setDisplayName(fullName || trimmedFirstName || "User");
    setEditableProfile({
      firstName: trimmedFirstName || "User",
      lastName: trimmedLastName,
      email: values.email,
      phone: values.phone.trim() || "-",
      bio: values.bio.trim() || "-",
      affiliation: values.affiliation.trim() || "-",
    });
    setCertificateName(trimmedCertificateName);
    if (trimmedCertificateName !== certificateName) {
      setLastCertificateNameUpdate(new Date().toISOString());
      setCertificateNote("Certificate name can be edited once per day.");
    }

    // update shared profile store (display name) so header updates
    try {
      useProfileStore.getState().setProfile({ fullName });
    } catch (e) {
      /* ignore */
    }
    // notify other components (header) that profile changed
    try {
      (window as any).dispatchEvent(new CustomEvent("profile:updated", { detail: { fullName: fullName } }));
    } catch (e) {
      /* ignore */
    }
  };

  const handleSaveAddress = async (values: EditableAddress) => {
    const nextAddress: EditableAddress = {
      country: values.country.trim() || "-",
      cityState: values.cityState.trim() || "-",
      postalCode: values.postalCode.trim() || "-",
      taxId: values.taxId.trim() || "-",
    };

    const { error } = await supabase.auth.updateUser({
      data: {
        country: nextAddress.country,
        city_state: nextAddress.cityState,
        postal_code: nextAddress.postalCode,
        tax_id: nextAddress.taxId,
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    setEditableAddress(nextAddress);
  };

  if (loading) {
    return (
      <section className="space-y-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading profile...</p>
        </div>
      </section>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
      <h3 className="mb-5 text-lg font-semibold text-gray-800 dark:text-white/90 lg:mb-7">Profile</h3>
      <div className="space-y-6">
        <UserMetaCard
          name={displayName}
          roleLabel={roleLabel(profile?.role)}
          location="-"
        />
        <UserInfoCard
          firstName={editableProfile.firstName}
          lastName={editableProfile.lastName}
          email={editableProfile.email || profile?.email || "-"}
          phone={editableProfile.phone}
          bio={editableProfile.bio}
          affiliation={editableProfile.affiliation}
          certificateName={certificateName || "-"}
        certificateNote={certificateNote}
          onSave={handleSaveUserInfo}
        />
        <UserAddressCard
          country={editableAddress.country}
          cityState={editableAddress.cityState}
          postalCode={editableAddress.postalCode}
          taxId={editableAddress.taxId}
          onSave={handleSaveAddress}
        />
      </div>
    </div>
  );
}
