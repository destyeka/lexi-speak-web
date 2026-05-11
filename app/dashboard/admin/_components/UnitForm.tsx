"use client";

import { InputField } from "@/components/ui/system/InputField";
import TextButton from "@/components/ui/system/TextButton";
import { Toggle } from "@/components/ui/system/Toggle";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { generateSessionCode } from "@/lib/generateSessionCode";

import { useState, useEffect } from "react";

type Detail = {
  type: "question" | "bullet";
  content: string;
  rubric: string;
};

type Props = {
  mode?: "create" | "edit";
  unitId?: string;
};

export default function UnitForm({
  mode = "create",
  unitId,
}: Props) {
  const router = useRouter();

  const [sessionTitle, setSessionTitle] = useState("");
  const [sessionDescription, setSessionDescription] =
    useState("");

  const [sessionType, setSessionType] = useState<
    "practice" | "test"
  >("practice");

  const [accessLevel, setAccessLevel] = useState<
    "free" | "premium"
  >("premium");

  const [isActive, setIsActive] = useState(true);

  const [customCategories, setCustomCategories] =
    useState<
      {
        id: string;
        name: string;
        code: string;
      }[]
    >([]);

  const [newCategoryName, setNewCategoryName] =
    useState("");
  const [newCategoryCode, setNewCategoryCode] =
    useState("");

  const [isCreatingCategory, setIsCreatingCategory] =
    useState(false);
  const [showCreateCategory, setShowCreateCategory] =
    useState(false);

  const [sessionCode, setSessionCode] =
    useState("");

  const [category, setCategory] = useState("");
  const [parts, setParts] = useState<
    Record<
      number,
      {
        topicId?: string;

        title: string;

        prompt: string;

        details: Detail[];
      }
    >
  >({
    1: {
      title: "",
      prompt: "",
      details: [],
    },

    2: {
      title: "",
      prompt: "",
      details: [],
    },

    3: {
      title: "",
      prompt: "",
      details: [],
    },
  });

  const [isSaving, setIsSaving] =
    useState(false);


  useEffect(() => {

    const loadCategories = async () => {

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data, error } =
        await supabase
          .from("custom_categories")
          .select("*")
          .eq("created_by", user.id)
          .order("name");

      if (!error && data) {
        setCustomCategories(data);
      }
    };

    loadCategories();

  }, []);

  useEffect(() => {

    if (
      mode !== "edit" ||
      !unitId
    ) return;

    const loadUnit =
      async () => {

        // 🔥 1. LOAD SESSION
        const {
          data: sessionData,
          error: sessionError,
        } = await supabase
          .from("session_units")
          .select("*")
          .eq("id", unitId)
          .single();

        if (
          sessionError ||
          !sessionData
        ) {
          console.error(sessionError);
          return;
        }

        // 🔥 SESSION STATE
        setSessionCode(
          sessionData.session_code || ""
        );

        setSessionTitle(
          sessionData.title || ""
        );

        setSessionDescription(
          sessionData.description || ""
        );

        setSessionType(
          sessionData.type
        );

        setCategory(
          sessionData.category
        );

        setAccessLevel(
          sessionData.access_level
        );

        setIsActive(
          sessionData.is_active
        );

        // 🔥 2. LOAD TOPICS
        const {
          data: topicsData,
        } = await supabase
          .from("topics")
          .select("*")
          .eq("unit_id", unitId)
          .order("part");

        if (!topicsData) return;

        const partsData: any = {
          1: {
            title: "",
            prompt: "",
            details: [],
          },

          2: {
            title: "",
            prompt: "",
            details: [],
          },

          3: {
            title: "",
            prompt: "",
            details: [],
          },
        };

        // 🔥 3. LOAD DETAILS
        for (const topic of topicsData) {

          const {
            data: detailsData,
          } = await supabase
            .from("topic_details")
            .select("*")
            .eq("topic_id", topic.id)
            .order("order_index");

          partsData[topic.part] = {

            topicId: topic.id,

            title: topic.title || "",

            prompt:
              topic.prompt || "",

            details:
              detailsData || [],
          };
        }

        setParts(partsData);
      };

    loadUnit();

  }, [mode, unitId]);

  const handleCreateCategory = async () => {

    try {

      setIsCreatingCategory(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      if (!newCategoryName.trim()) {
        alert("Category name required");
        return;
      }

      if (!newCategoryCode.trim()) {
        alert("Category code required");
        return;
      }

      if (newCategoryCode.length > 4) {
        alert("Code max 4 characters");
        return;
      }

      const normalizedCode =
        newCategoryCode
          .trim()
          .toUpperCase();

      const { data, error } =
        await supabase
          .from("custom_categories")
          .insert({
            name: newCategoryName.trim(),

            code: normalizedCode,

            created_by: user.id,
          })
          .select()
          .single();

      if (error) {
        console.error(error);
        alert(error.message);
        return;
      }

      setCustomCategories((prev) => [
        ...prev,
        data,
      ]);

      setNewCategoryName("");
      setNewCategoryCode("");

    } catch (err) {

      console.error(err);

    } finally {

      setIsCreatingCategory(false);
    }
  };

  const handleSave = async () => {
    try {

      setIsSaving(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        alert("Unauthorized");
        setIsSaving(false);
        return;
      }

      if (!category) {
        alert("Please select a category");
        setIsSaving(false);
        return;
      }

      if (!sessionTitle.trim()) {
        alert("Unit title is required");
        setIsSaving(false);
        return;
      }

      for (const part of [1, 2, 3]) {

        const current =
          parts[part as 1 | 2 | 3];

        if (!current.title.trim()) {
          alert(`Part ${part} title is required`);
          setIsSaving(false);
          return;
        }

        if (current.details.length === 0) {
          alert(
            `Part ${part} must have at least one detail`
          );

          setIsSaving(false);
          return;
        }
      }

      const systemCategoryMap: Record<string, string> = {
        music: "MUS",
        identity: "IDN",
        education: "EDU",
        culinary: "CUL",
        travel: "TRV",
        art: "ART",
        sports: "SPT",
        technology: "TEC",
        health: "HLT",
        business: "BUS",
      };

      // 🔥 Try system category first
      let categoryCode: string | null =
        systemCategoryMap[category] || null;

      // 🔥 Fallback to custom categories
      if (!categoryCode) {

        const customCategory =
          customCategories.find(
            (cat) =>
              cat.name.toLowerCase() ===
              category.toLowerCase()
          );

        categoryCode =
          customCategory?.code || null;
      }

      // 🔥 Still invalid
      if (!categoryCode) {

        alert("Invalid category");

        setIsSaving(false);

        return;
      }

      const {
        sessionCode,
        seq,
      } = await generateSessionCode({
        session: sessionType,
        category,
        categoryCode,
      });

      let sessionData: any = null;

      if (mode === "create") {

        const {
          data,
          error,
        } = await supabase
          .from("session_units")
          .insert({
            session_code: sessionCode,

            seq,

            category_code:
              categoryCode,

            title: sessionTitle,

            description:
              sessionDescription,

            type: sessionType,

            created_by: user.id,

            access_level:
              accessLevel,

            is_active: isActive,

            category,
          })
          .select()
          .single();

        if (error) {

          console.log(error);

          setIsSaving(false);

          return;
        }

        sessionData = data;

      } else {

        const {
          data,
          error,
        } = await supabase
          .from("session_units")
          .update({

            title: sessionTitle,

            description:
              sessionDescription,

            type: sessionType,

            access_level:
              accessLevel,

            is_active: isActive,

            category,

            category_code:
              categoryCode,

          })
          .eq("id", unitId)
          .select()
          .single();

        if (error) {

          console.log(error);

          setIsSaving(false);

          return;
        }

        sessionData = data;
      }

      for (const part of [1, 2, 3]) {

        const partData =
          parts[part as 1 | 2 | 3];

        let topicData: any = null;

        // 🔥 CREATE
        if (
          mode === "create" ||
          !partData.topicId
        ) {

          const {
            data,
            error,
          } = await supabase
            .from("topics")
            .insert({

              unit_id: sessionData.id,

              topic_code:
                `${sessionData.session_code}-P${part}`,

              category,

              category_code:
                categoryCode,

              session: sessionType,

              title: partData.title,

              prompt:
                partData.prompt,

              part,
            })
            .select()
            .single();

          if (error) {

            console.error(error);

            setIsSaving(false);

            return;
          }

          topicData = data;

        } else {

          // 🔥 UPDATE
          const {
            data,
            error,
          } = await supabase
            .from("topics")
            .update({

              category,

              category_code:
                categoryCode,

              session: sessionType,

              title: partData.title,

              prompt:
                partData.prompt,

            })
            .eq(
              "id",
              partData.topicId
            )
            .select()
            .single();

          if (error) {

            console.error(error);

            setIsSaving(false);

            return;
          }

          topicData = data;

          // 🔥 DELETE OLD DETAILS
          await supabase
            .from("topic_details")
            .delete()
            .eq(
              "topic_id",
              topicData.id
            );
        }

        // 🔥 REINSERT DETAILS
        if (
          partData.details.length > 0
        ) {

          const formattedDetails =
            partData.details.map(
              (
                detail,
                index
              ) => ({
                topic_id:
                  topicData.id,

                type: detail.type,

                content:
                  detail.content,

                rubric:
                  detail.rubric,

                order_index:
                  index,
              })
            );

          const {
            error: detailError,
          } = await supabase
            .from("topic_details")
            .insert(
              formattedDetails
            );

          if (detailError) {
            console.error(
              detailError
            );
          }
        }
      }
      setIsSaving(false);

      // 🔥 SUCCESS
      router.push("/dashboard/admin/question-bank");

    } catch (err) {

      console.error("SAVE ERROR:", err);

      setIsSaving(false);
    }
  };
  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 min-h-screen">

      {/* LEFT */}
      <div className="xl:col-span-4">
        <div className="sticky top-4 rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">

          {/* HEADER */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
              {mode === "edit"
                ? "Edit Unit"
                : "Create Unit"}

            </h1>

            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {mode === "edit"
                ? `Configure session ${sessionCode}`
                : "Configure your IELTS speaking session."}
            </p>
          </div>

          {/* CATEGORY */}
          <div className="mb-4">
            <p className="mb-2 text-sm font-semibold text-primary">
              Category
            </p>

            <div className="w-full rounded-2xl p-3 text-primary outline-dashed outline-[var(--primary)]">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-transparent outline-none"
              >
                <option value="">Select Category</option>

                <option value="music">Music</option>
                <option value="identity">Identity</option>
                <option value="education">Education</option>
                <option value="culinary">Culinary</option>
                <option value="travel">Travel</option>
                <option value="art">Art</option>
                <option value="sports">Sports</option>
                <option value="technology">Technology</option>
                <option value="health">Health</option>
                <option value="business">Business</option>

                {customCategories.length > 0 && (
                  <optgroup label="Custom Categories">

                    {customCategories.map((cat) => (
                      <option
                        key={cat.id}
                        value={cat.name.toLowerCase()}
                      >
                        {cat.name}
                      </option>
                    ))}

                  </optgroup>
                )}
              </select>
            </div>
          </div>

          <div className="mb-3">

            {!showCreateCategory ? (

              <button
                type="button"
                onClick={() =>
                  setShowCreateCategory(true)
                }
                className="text-sm font-medium text-primary hover:underline"
              >
                Or create custom category
              </button>

            ) : (

              <div className="rounded-2xl border border-dashed border-gray-300 p-4 dark:border-gray-700">

                <div className="mb-3 flex items-center justify-between">

                  <p className="text-sm font-semibold text-primary">
                    Create Custom Category
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      setShowCreateCategory(false)
                    }
                    className="text-sm text-gray-400 hover:text-red-500"
                  >
                    ✕
                  </button>
                </div>

                <div className="mb-3">
                  <InputField
                    value={newCategoryName}
                    onChange={setNewCategoryName}
                    placeholder="Category name"
                  />
                </div>

                <div className="mb-4">
                  <InputField
                    value={newCategoryCode}
                    onChange={setNewCategoryCode}
                    placeholder="Code (max 4 chars)"
                  />
                </div>

                <TextButton
                  variant="secondary"
                  onClick={handleCreateCategory}
                  disabled={isCreatingCategory}
                >
                  {isCreatingCategory
                    ? "Creating..."
                    : "Add Category"}
                </TextButton>

              </div>

            )}
          </div>

          {/* TITLE */}
          <label className="block mb-4 text-sm font-semibold text-primary">
            Unit Title

            <InputField
              className="mt-2"
              value={sessionTitle}
              onChange={setSessionTitle}
              placeholder="Unit Title"
            />
          </label>

          {/* DESCRIPTION */}
          <label className="block mb-4 text-sm font-semibold text-primary">
            Description

            <InputField
              multiline
              rows={3}
              className="mt-2"
              value={sessionDescription}
              onChange={setSessionDescription}
              placeholder="Description"
            />
          </label>

          {/* SESSION TYPE */}
          <div className="mb-4">
            <p className="mb-2 text-sm font-semibold text-primary">
              Session Type
            </p>

            <div className="w-full rounded-2xl p-3 text-primary outline-dashed outline-[var(--primary)]">
              <select
                value={sessionType}
                onChange={(e) =>
                  setSessionType(
                    e.target.value as "practice" | "test"
                  )
                }
                className="w-full bg-transparent outline-none"
              >
                <option value="practice">PRACTICE</option>
                <option value="test">TEST</option>
              </select>
            </div>
          </div>

          {/* ACCESS */}
          <div className="mb-6">
            <p className="mb-2 text-sm font-semibold text-primary">
              Access Level
            </p>

            <div className="w-full rounded-2xl p-3 text-primary outline-dashed outline-[var(--primary)]">
              <select
                value={accessLevel}
                onChange={(e) =>
                  setAccessLevel(
                    e.target.value as "free" | "premium"
                  )
                }
                className="w-full bg-transparent outline-none"
              >
                <option value="premium">PREMIUM</option>
                <option value="free">FREE</option>
              </select>
            </div>
          </div>

          {/* ACTIVE */}
          <div className="mb-8 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Activate Unit
            </span>

            <Toggle
              checked={isActive}
              onChange={setIsActive}
            />
          </div>

          {/* ACTIONS */}
          <div className="w-full flex gap-3">
            <TextButton
              className="flex-1"
              variant="secondary"
              onClick={() =>
                router.push(
                  "/dashboard/admin/question-bank"
                )
              }
            >
              Cancel
            </TextButton>

            <TextButton
              className="flex-1"
              variant="primary"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving
                ? "Saving..."
                : "Save Unit"}
            </TextButton>
          </div>

        </div>
      </div>

      {/* RIGHT */}
      <div className="xl:col-span-8 overflow-y-auto xl:pr-2 pb-10">
        <div className="flex flex-col gap-6 pb-20">

          {[1, 2, 3].map((part) => (
            <div
              key={part}
              className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]"
            >

              {/* HEADER */}
              <div className="mb-6">
                <p className="mb-2 not-last:text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {part === 1
                  ? "Introduction"
                  : part === 2 ? "Individual Long Turn"
                  : "Two-way Discussion"}
                </p>

                <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
                  Part {part}
                </h2>
              </div>

              {/* TITLE */}
              <label className="w-full block text-base font-bold text-primary mb-4">
                Topic Title

                <InputField
                  className="mt-2"
                  value={parts[part as 1 | 2 | 3].title}
                  onChange={(v) =>
                    setParts((prev) => ({
                      ...prev,
                      [part]: {
                        ...prev[part as 1 | 2 | 3],
                        title: v,
                      },
                    }))
                  }
                  placeholder={`Part ${part} title`}
                />
              </label>

              {/* PROMPT */}
              <label className="w-full block text-base font-bold text-primary mb-6">
                Prompt

                <InputField
                  multiline
                  rows={1}
                  className="mt-2"
                  value={parts[part as 1 | 2 | 3].prompt}
                  onChange={(v) =>
                    setParts((prev) => ({
                      ...prev,
                      [part]: {
                        ...prev[part as 1 | 2 | 3],
                        prompt: v,
                      },
                    }))
                  }
                  placeholder={`Part ${part} user prompt`}
                />
              </label>

              {/* DETAILS */}
              <div className="space-y-3">
                {parts[part as 1 | 2 | 3].details.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400 dark:border-gray-700">
                    No details added yet.
                  </div>
                )}

                {/* EXAMPLE DETAIL */}
                {parts[part as 1 | 2 | 3].details.map((detail, i) => (
                  <div
                    key={i}
                    className="rounded-2xl border border-gray-200 p-4 dark:border-gray-700"
                  >

                    {/* TOP */}
                    <div className="mb-4 flex items-center justify-between">

                      <div className="flex items-center gap-3">

                        {/* NUMBER */}
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-sm font-semibold text-gray-500 dark:bg-gray-800 dark:text-gray-300">
                          {i + 1}
                        </div>

                        {/* TYPE */}
                        <div className="flex
                        rounded-xl h-10 justify-center items-center text-xs font-semibold uppercase bg-gray-100 px-4 text-gray-600 dark:bg-gray-800 dark:text-gray-300">

                          {part === 2
                            ? "Bullet"
                            : detail.type === "question"
                              ? "Question"
                              : "Bullet"}

                        </div>
                      </div>

                      {/* DELETE */}
                      <button
                        onClick={() => {
                          const updated =
                            parts[
                              part as 1 | 2 | 3
                            ].details.filter(
                              (_, idx) => idx !== i
                            );

                          setParts((prev) => ({
                            ...prev,
                            [part]: {
                              ...prev[
                              part as 1 | 2 | 3
                              ],
                              details: updated,
                            },
                          }));
                        }}
                        className="rounded-xl px-3 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                      >
                        ✕
                      </button>
                    </div>

                    {/* CONTENT */}
                    <div className="mb-3">
                      <p className="mb-2 text-sm font-semibold text-primary">
                        Content
                      </p>

                      <InputField
                        value={detail.content}
                        onChange={(v) => {
                          const updated = [
                            ...parts[
                              part as 1 | 2 | 3
                            ].details,
                          ];

                          updated[i].content = v;

                          setParts((prev) => ({
                            ...prev,
                            [part]: {
                              ...prev[
                              part as 1 | 2 | 3
                              ],
                              details: updated,
                            },
                          }));
                        }}
                        placeholder="Content"
                      />
                    </div>

                    {/* RUBRIC */}
                    <div>
                      <p className="mb-2 text-sm font-semibold text-primary">
                        Rubric
                      </p>

                      <InputField
                        multiline
                        rows={5}
                        value={detail.rubric || ""}
                        onChange={(v) => {
                          const updated = [
                            ...parts[
                              part as 1 | 2 | 3
                            ].details,
                          ];

                          updated[i].rubric = v;

                          setParts((prev) => ({
                            ...prev,
                            [part]: {
                              ...prev[
                              part as 1 | 2 | 3
                              ],
                              details: updated,
                            },
                          }));
                        }}
                        placeholder="Rubric for AI"
                      />
                    </div>

                  </div>
                ))}
              </div>

              {/* ADD DETAIL */}
              <button
                onClick={() => {
                  setParts((prev) => ({
                    ...prev,
                    [part]: {
                      ...prev[part as 1 | 2 | 3],

                      details: [
                        ...prev[part as 1 | 2 | 3].details,

                        {
                          type:
                            part === 2
                              ? "bullet"
                              : "question",

                          content: "",
                          rubric: "",
                        },
                      ],
                    },
                  }));
                }}
                className="text-primary mt-4"
              >
                + Add {part === 2 ? "Bullet" : "Detail"}
              </button>

            </div>
          ))}

        </div>
      </div>
    </div >
  );
}

