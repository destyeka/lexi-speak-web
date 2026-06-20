"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type AppRole = "user" | "guru" | "admin";

type ProfileRow = {
  id: string;
  email: string;
  role: AppRole;
  coach_id: string | null;
  created_at: string | null;
};

type LlmSettingRow = {
  id: string;
  setting_name: string | null;
  provider_name: string;
  base_url: string;
  model_name: string;
  api_key?: string;
  is_active: boolean;
  created_at: string | null;
};

type ProviderOption = {
  id: string;
  name: string;
  badge: "FREE" | "FREE MODELS";
  baseUrl: string;
  models: {
    label: string;
    value: string;
    description?: string;
  }[];
};

const LLM_PROVIDERS: ProviderOption[] = [
  {
    id: "groq",
    name: "Groq",
    badge: "FREE",
    baseUrl: "https://api.groq.com/openai/v1/chat/completions",
    models: [
      {
        label: "Llama 3.1 8B Instant",
        value: "llama-3.1-8b-instant",
        description: "Fast free-tier option. Good for quick feedback.",
      },
      {
        label: "Llama 3.3 70B Versatile",
        value: "llama-3.3-70b-versatile",
        description: "Stronger feedback quality, but may hit free rate limits faster.",
      },
    ],
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    badge: "FREE MODELS",
    baseUrl: "https://openrouter.ai/api/v1/chat/completions",
    models: [
      {
        label: "OpenRouter Free Router",
        value: "openrouter/free",
        description: "Automatically routes to available free models.",
      },
    ],
  },
  {
    id: "gemini",
    name: "Google Gemini",
    badge: "FREE",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    models: [
      {
        label: "Gemini Flash",
        value: "gemini-2.5-flash",
        description: "Free-tier Gemini option, rate-limited.",
      },
      {
        label: "Gemini Flash Lite",
        value: "gemini-2.5-flash-lite",
        description: "Lighter and usually better for low-cost/free usage.",
      },
    ],
  },
];

export default function AdminDashboardPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [assigningStudentId, setAssigningStudentId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isUnauthorized, setIsUnauthorized] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [pageSize, setPageSize] = useState<5 | 10>(10);
  const [currentPage, setCurrentPage] = useState(1);

  const [llmSettings, setLlmSettings] = useState<LlmSettingRow[]>([]);
  const [loadingLlmSettings, setLoadingLlmSettings] = useState(true);
  const [savingLlmSetting, setSavingLlmSetting] = useState(false);
  const [editingLlmId, setEditingLlmId] = useState<string | null>(null);
  const [isLlmFormOpen, setIsLlmFormOpen] = useState(false);

  const [selectedProviderId, setSelectedProviderId] = useState("groq");
  const [selectedModelName, setSelectedModelName] = useState(
    LLM_PROVIDERS[0].models[0].value
  );
  const [apiKey, setApiKey] = useState("");
  const [setAsActive, setSetAsActive] = useState(true);
  const [showApiKey, setShowApiKey] = useState(false);
  const [settingName, setSettingName] = useState("");

  const counters = useMemo(() => {
    const total = profiles.length;
    const students = profiles.filter((p) => p.role === "user").length;
    const gurus = profiles.filter((p) => p.role === "guru").length;
    const admins = profiles.filter((p) => p.role === "admin").length;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const newStudents7d = profiles.filter((p) => {
      if (p.role !== "user" || !p.created_at) return false;
      return new Date(p.created_at) >= sevenDaysAgo;
    }).length;

    return { total, students, gurus, admins, newStudents7d };
  }, [profiles]);

  const selectedProvider = useMemo(
    () =>
      LLM_PROVIDERS.find((provider) => provider.id === selectedProviderId) ??
      LLM_PROVIDERS[0],
    [selectedProviderId]
  );

  const selectedModel = useMemo(
    () =>
      selectedProvider.models.find((model) => model.value === selectedModelName) ??
      selectedProvider.models[0],
    [selectedProvider, selectedModelName]
  );

  const handleProviderChange = (providerId: string) => {
    const provider =
      LLM_PROVIDERS.find((item) => item.id === providerId) ?? LLM_PROVIDERS[0];

    setSelectedProviderId(provider.id);
    setSelectedModelName(provider.models[0].value);
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setNotice("");
      setIsUnauthorized(false);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      setCurrentUserId(user.id);

      const metadataRole =
        user.user_metadata?.role === "admin" ||
          user.user_metadata?.role === "guru" ||
          user.user_metadata?.role === "user"
          ? (user.user_metadata.role as AppRole)
          : "user";

      const { data: me, error: meError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (meError) {
        setNotice("Failed to validate your admin access. Please refresh this page.");
        setLoading(false);
        return;
      }

      let myRole: AppRole | null = (me?.role as AppRole | null) ?? null;

      if (!me) {
        const { error: bootstrapError } = await supabase.from("profiles").upsert(
          {
            id: user.id,
            email: user.email ?? "unknown@example.com",
            role: metadataRole,
          },
          { onConflict: "id" }
        );

        if (bootstrapError) {
          setNotice(
            "Profile row is missing and auto-create failed. Check Supabase RLS policy for profiles table."
          );
          setLoading(false);
          return;
        }

        myRole = metadataRole;
      }

      if (myRole !== "admin") {
        setIsUnauthorized(true);
        setNotice("You are signed in, but your role is not admin.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, role, coach_id, created_at")
        .order("created_at", { ascending: false });

      if (error) {
        setNotice(error.message);
      }

      setProfiles((data as ProfileRow[] | null) ?? []);

      const { data: llmData, error: llmError } = await supabase
        .from("llm_settings")
        .select("id, setting_name, provider_name, base_url, model_name, api_key, is_active, created_at")
        .order("created_at", { ascending: false });

      if (llmError) {
        console.error("Failed to load LLM settings:", llmError);
        setNotice(llmError.message);
      }

      setLlmSettings((llmData as LlmSettingRow[] | null) ?? []);

      setLoading(false);
      setLoadingLlmSettings(false);
    };

    void load();
  }, [router]);

  const handleRoleChange = async (id: string, role: AppRole) => {
    setSavingId(id);
    setNotice("");

    const { error } = await supabase.from("profiles").update({ role }).eq("id", id);

    if (error) {
      setNotice(error.message);
      setSavingId(null);
      return;
    }

    setProfiles((prev) => prev.map((row) => (row.id === id ? { ...row, role } : row)));
    setSavingId(null);
  };

  const filteredProfiles = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return profiles.filter((row) => {
      if (!query) return true;
      return row.email.toLowerCase().includes(query) || row.role.toLowerCase().includes(query);
    });
  }, [profiles, searchTerm]);

  const coaches = useMemo(
    () => profiles.filter((row) => row.role === "guru").map((row) => ({ id: row.id, email: row.email })),
    [profiles]
  );

  const resetLlmForm = () => {
    setEditingLlmId(null);
    setSelectedProviderId("groq");
    setSelectedModelName(LLM_PROVIDERS[0].models[0].value);
    setSettingName("");
    setApiKey("");
    setShowApiKey(false);
    setSetAsActive(true);
    setIsLlmFormOpen(false);
  };

  const handleAddLlmSetting = () => {
    setEditingLlmId(null);
    setSelectedProviderId("groq");
    setSelectedModelName(LLM_PROVIDERS[0].models[0].value);
    setSettingName("");
    setApiKey("");
    setShowApiKey(false);
    setSetAsActive(true);
    setIsLlmFormOpen(true);
  };

  const handleSaveLlmSetting = async () => {
    setNotice("");

    if (!selectedProvider || !selectedModelName.trim()) {
      setNotice("Please choose provider and model.");
      return;
    }

    if (!editingLlmId && !apiKey.trim()) {
      setNotice("Please fill the API key.");
      return;
    }

    setSavingLlmSetting(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setNotice("Please login again.");
      setSavingLlmSetting(false);
      return;
    }

    if (setAsActive) {
      const { error: deactivateError } = await supabase
        .from("llm_settings")
        .update({ is_active: false })
        .eq("is_active", true);

      if (deactivateError) {
        setNotice(deactivateError.message);
        setSavingLlmSetting(false);
        return;
      }
    }

    const payload: Record<string, unknown> = {
      setting_name:
        settingName.trim() ||
        `${selectedProvider.name} - ${selectedModelName}`,
      provider_name: selectedProvider.name,
      base_url: selectedProvider.baseUrl,
      model_name: selectedModelName,
      is_active: setAsActive,
    };

    if (apiKey.trim()) {
      payload.api_key = apiKey.trim();
    }

    let error;

    if (editingLlmId) {
      const result = await supabase
        .from("llm_settings")
        .update(payload)
        .eq("id", editingLlmId);

      error = result.error;
    } else {
      const result = await supabase.from("llm_settings").insert({
        ...payload,
        api_key: apiKey.trim(),
        created_by: user.id,
      });

      error = result.error;
    }

    if (error) {
      setNotice(error.message);
      setSavingLlmSetting(false);
      return;
    }

    const { data: refreshed, error: refreshError } = await supabase
      .from("llm_settings")
      .select("id, setting_name, provider_name, base_url, model_name, api_key, is_active, created_at")
      .order("created_at", { ascending: false });

    if (refreshError) {
      setNotice(refreshError.message);
    } else {
      setLlmSettings((refreshed as LlmSettingRow[] | null) ?? []);
    }

    resetLlmForm();
    setSavingLlmSetting(false);
    setNotice(editingLlmId ? "LLM setting updated successfully." : "LLM setting saved successfully.");
  };

  const handleActivateLlmSetting = async (id: string) => {
    setNotice("");
    setSavingLlmSetting(true);

    const { error: deactivateError } = await supabase
      .from("llm_settings")
      .update({ is_active: false })
      .eq("is_active", true);

    if (deactivateError) {
      setNotice(deactivateError.message);
      setSavingLlmSetting(false);
      return;
    }

    const { error } = await supabase
      .from("llm_settings")
      .update({ is_active: true })
      .eq("id", id);

    if (error) {
      setNotice(error.message);
      setSavingLlmSetting(false);
      return;
    }

    setLlmSettings((prev) =>
      prev.map((setting) => ({
        ...setting,
        is_active: setting.id === id,
      }))
    );

    setSavingLlmSetting(false);
    setNotice("Active LLM setting updated.");
  };

  const handleEditLlmSetting = (setting: LlmSettingRow) => {
    const matchedProvider =
      LLM_PROVIDERS.find((provider) => provider.baseUrl === setting.base_url) ??
      LLM_PROVIDERS[0];

    setEditingLlmId(setting.id);
    setSelectedProviderId(matchedProvider.id);

    const matchedModel =
      matchedProvider.models.find((model) => model.value === setting.model_name) ??
      matchedProvider.models[0];

    setSelectedModelName(matchedModel.value);
    setSettingName(setting.setting_name ?? "");
    setApiKey(setting.api_key ?? "");
    setShowApiKey(false);
    setSetAsActive(setting.is_active);
    setIsLlmFormOpen(true);

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDeleteLlmSetting = async (id: string) => {
    const target = llmSettings.find((setting) => setting.id === id);

    const confirmed = window.confirm(
      target?.is_active
        ? "This is the active LLM setting. Deleting it may stop AI evaluation until another provider is activated. Continue?"
        : "Delete this LLM setting? This cannot be undone."
    );

    if (!confirmed) return;

    setNotice("");
    setSavingLlmSetting(true);

    const { error } = await supabase
      .from("llm_settings")
      .delete()
      .eq("id", id);

    if (error) {
      setNotice(error.message);
      setSavingLlmSetting(false);
      return;
    }

    setLlmSettings((prev) => prev.filter((setting) => setting.id !== id));

    if (editingLlmId === id) {
      resetLlmForm();
    }

    setSavingLlmSetting(false);
    setNotice("LLM setting deleted.");
  };

  const handleCoachAssign = async (studentId: string, coachId: string | null) => {
    setAssigningStudentId(studentId);
    setNotice("");

    const { error } = await supabase
      .from("profiles")
      .update({ coach_id: coachId })
      .eq("id", studentId)
      .eq("role", "user");

    if (error) {
      setNotice(error.message);
      setAssigningStudentId(null);
      return;
    }

    setProfiles((prev) =>
      prev.map((row) => (row.id === studentId ? { ...row, coach_id: coachId } : row))
    );

    setAssigningStudentId(null);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, pageSize]);

  const totalRows = filteredProfiles.length;
  const pageCount = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePage = Math.min(currentPage, pageCount);
  const startIndex = (safePage - 1) * pageSize;
  const visibleRows = filteredProfiles.slice(startIndex, startIndex + pageSize);
  const startLabel = totalRows === 0 ? 0 : startIndex + 1;
  const endLabel = Math.min(startIndex + pageSize, totalRows);

  useEffect(() => {
    if (currentPage > pageCount) {
      setCurrentPage(pageCount);
    }
  }, [currentPage, pageCount]);

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">Admin Dashboard</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Track students and maintain all role accounts from one admin panel.
        </p>
        {notice ? <p className="mt-3 text-sm text-error-600">{notice}</p> : null}
      </div>

      {/* LLM settings */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">
              LLM API Settings
            </h1>

            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Manage the AI provider used for speaking evaluation. Only the active provider will be used.
            </p>
          </div>

          <button
            type="button"
            onClick={handleAddLlmSetting}
            disabled={savingLlmSetting}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            + Add LLM
          </button>
        </div>

        {isLlmFormOpen ? (
          <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/40">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-800 dark:text-white/90">
                  {editingLlmId ? "Edit LLM Provider" : "Add New LLM Provider"}
                </h2>

                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {editingLlmId
                    ? "Update provider, model, name, or API key. Use Show/Hide if you need to check the saved key."
                    : "Choose a provider, select a model, name this setting, and paste its API key."}
                </p>
              </div>

              <button
                type="button"
                onClick={resetLlmForm}
                disabled={savingLlmSetting}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
              >
                Close
              </button>
            </div>

            {editingLlmId ? (
              <p className="mb-4 rounded-lg bg-yellow-50 px-3 py-2 text-sm font-medium text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-300">
                Editing existing LLM setting. The saved API key is loaded in the field below.
              </p>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Setting Name
                </label>

                <input
                  value={settingName}
                  onChange={(event) => setSettingName(event.target.value)}
                  placeholder="Example: Groq Main Key, Gemini Backup, OpenRouter Test"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                />

                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Use this to distinguish settings with the same provider/model but different API keys.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Provider
                </label>

                <select
                  value={selectedProviderId}
                  onChange={(event) => handleProviderChange(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                >
                  {LLM_PROVIDERS.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name} ({provider.badge})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Model
                </label>

                <select
                  value={selectedModelName}
                  onChange={(event) => setSelectedModelName(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                >
                  {selectedProvider.models.map((model) => (
                    <option key={model.value} value={model.value}>
                      {model.label}
                    </option>
                  ))}
                </select>

                {selectedModel?.description ? (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {selectedModel.description}
                  </p>
                ) : null}
              </div>

              <div className="rounded-lg bg-white p-3 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400 md:col-span-2">
                <p>
                  Endpoint:{" "}
                  <span className="font-mono">{selectedProvider.baseUrl}</span>
                </p>
                <p className="mt-1">
                  Model ID:{" "}
                  <span className="font-mono">{selectedModelName}</span>
                </p>
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  API Key
                </label>

                <div className="flex gap-2">
                  <input
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                    type={showApiKey ? "text" : "password"}
                    placeholder="Paste API key here"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  />

                  <button
                    type="button"
                    onClick={() => setShowApiKey((value) => !value)}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-white dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
                  >
                    {showApiKey ? "Hide" : "Show"}
                  </button>
                </div>

                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {editingLlmId
                    ? "You are editing the saved API key. Changing this field will replace the saved key."
                    : "The API key is saved for server-side evaluation only. Students and coaches should not see it."}
                </p>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={setAsActive}
                  onChange={(event) => setSetAsActive(event.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                Set as active provider
              </label>
            </div>

            <div className="mt-5 flex items-center gap-3">
              <button
                type="button"
                onClick={handleSaveLlmSetting}
                disabled={savingLlmSetting}
                className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingLlmSetting
                  ? "Saving..."
                  : editingLlmId
                    ? "Update LLM Setting"
                    : "Save LLM Setting"}
              </button>

              <button
                type="button"
                onClick={resetLlmForm}
                disabled={savingLlmSetting}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-6">
          <h2 className="text-base font-semibold text-gray-800 dark:text-white/90">
            Saved Providers
          </h2>

          {loadingLlmSettings ? (
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
              Loading LLM settings...
            </p>
          ) : llmSettings.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
              No LLM settings saved yet.
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              {llmSettings.map((setting) => (
                <div
                  key={setting.id}
                  className={`rounded-lg border-2 p-4 transition ${setting.is_active
                    ? "border-brand-500 bg-brand-50 dark:border-brand-500 dark:bg-brand-500/10"
                    : "border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-800"
                    }`}
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="font-medium text-gray-800 dark:text-white/90">
                            {setting.setting_name || setting.provider_name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {setting.provider_name}
                          </p>
                        </div>

                        {setting.is_active ? (
                          <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700 dark:bg-green-500/20 dark:text-green-400">
                            Active
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                        Model: <span className="font-mono">{setting.model_name}</span>
                      </p>

                      <p className="mt-1 break-all text-xs text-gray-600 dark:text-gray-400">
                        Base URL: <span className="font-mono">{setting.base_url}</span>
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {!setting.is_active ? (
                        <button
                          type="button"
                          onClick={() => handleActivateLlmSetting(setting.id)}
                          disabled={savingLlmSetting}
                          className="rounded-lg border border-brand-500 px-4 py-2 text-sm font-semibold text-brand-600 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-brand-500/10"
                        >
                          Set Active
                        </button>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => handleEditLlmSetting(setting)}
                        disabled={savingLlmSetting}
                        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteLlmSetting(setting.id)}
                        disabled={savingLlmSetting}
                        className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-500/10"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Total Accounts</p>
          <p className="mt-2 text-2xl font-bold text-gray-800 dark:text-white/90">{counters.total}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Students</p>
          <p className="mt-2 text-2xl font-bold text-gray-800 dark:text-white/90">{counters.students}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Coaches</p>
          <p className="mt-2 text-2xl font-bold text-gray-800 dark:text-white/90">{counters.gurus}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Admins</p>
          <p className="mt-2 text-2xl font-bold text-gray-800 dark:text-white/90">{counters.admins}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">New Students (7d)</p>
          <p className="mt-2 text-2xl font-bold text-gray-800 dark:text-white/90">{counters.newStudents7d}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-800 dark:text-white/90">All Roles Maintenance</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Search account by email/role, change role, and manage test-time coach links with pagination.
          </p>
        </div>

        <div className="flex flex-col gap-4 border-b border-gray-100 px-5 py-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search..."
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 sm:w-72 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
          />
          <div className="flex items-center gap-2">
            <select
              value={pageSize}
              onChange={(event) => setPageSize(parseInt(event.target.value) as 5 | 10)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
            </select>
            <span className="text-sm text-gray-600 dark:text-gray-400">entries per page</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          {isUnauthorized ? (
            <div className="px-5 py-6 text-sm text-gray-600 dark:text-gray-300">
              Admin access required. Please set your account role to <span className="font-semibold">admin</span> in Supabase table <span className="font-semibold">profiles</span>.
            </div>
          ) : (
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Email</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Role</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Test Coach</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Created</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="px-5 py-4 text-sm text-gray-500" colSpan={4}>Loading profiles...</td>
                  </tr>
                ) : visibleRows.length === 0 ? (
                  <tr>
                    <td className="px-5 py-4 text-sm text-gray-500" colSpan={4}>No profiles found.</td>
                  </tr>
                ) : (
                  visibleRows.map((row) => (
                    <tr key={row.id} className="border-b border-gray-100 last:border-0 dark:border-gray-800">
                      <td className="px-5 py-4 text-sm font-medium text-gray-800 dark:text-white/90">{row.email}</td>
                      <td className="px-5 py-4 text-sm text-gray-700 dark:text-gray-300">
                        <select
                          value={row.role}
                          disabled={savingId === row.id}
                          onChange={(event) => handleRoleChange(row.id, event.target.value as AppRole)}
                          className="w-36 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                        >
                          <option value="user">student</option>
                          <option value="guru">coach</option>
                          <option value="admin">admin</option>
                        </select>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-700 dark:text-gray-300">
                        {row.role === "user" ? (
                          <select
                            value={row.coach_id ?? ""}
                            disabled={assigningStudentId === row.id}
                            onChange={(event) =>
                              handleCoachAssign(row.id, event.target.value || null)
                            }
                            className="w-52 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                          >
                            <option value="">No test coach</option>
                            {coaches.map((coach) => (
                              <option key={coach.id} value={coach.id}>
                                {coach.email}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {row.created_at ? new Date(row.created_at).toLocaleDateString() : "-"}
                        {row.id === currentUserId ? (
                          <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                            You
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {!loading ? (
          <div className="space-y-3 border-t border-gray-100 px-5 py-4 dark:border-gray-800 sm:flex sm:items-center sm:justify-between sm:space-y-0">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {totalRows === 0 ? "No profiles found" : `Showing ${startLabel} to ${endLabel} of ${totalRows} entries`}
            </p>
            {totalRows > 0 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage((value) => Math.max(1, value - 1))}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
                >
                  ‹
                </button>
                {Array.from({ length: pageCount }, (_, index) => index + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition ${safePage === page
                      ? "bg-brand-500 text-white"
                      : "border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
                      }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={safePage >= pageCount}
                  onClick={() => setCurrentPage((value) => Math.min(pageCount, value + 1))}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
                >
                  ›
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
