"use client";
import React, { useEffect, useState } from "react";
import { useModal } from "../../hooks/useModal";
import { Modal } from "../ui/modal/index";
import Button from "../ui/button/Button";
import Input from "../form/input/InputField";
import Label from "../form/Label";

type UserInfoCardProps = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  bio?: string;
  affiliation?: string;
  certificateName?: string;
  certificateNote?: string;
  onSave: (values: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    bio: string;
    affiliation: string;
    certificateName: string;
  }) => Promise<void>;
};

export default function UserInfoCard({
  firstName,
  lastName,
  email,
  phone = "-",
  bio = "-",
  affiliation = "-",
  certificateName = "-",
  certificateNote,
  onSave,
}: UserInfoCardProps) {
  const { isOpen, openModal, closeModal } = useModal();
  const [formValues, setFormValues] = useState({
    firstName,
    lastName,
    email,
    phone,
    bio,
    affiliation,
    certificateName,
  });
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    setFormValues({
      firstName,
      lastName,
      email,
      phone,
      bio,
      affiliation,
      certificateName,
    });
  }, [firstName, lastName, email, phone, bio, affiliation, certificateName]);

  const handleInputChange = (key: keyof typeof formValues) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setFormValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setStatus(null);

    try {
      await onSave({
        firstName: formValues.firstName,
        lastName: formValues.lastName,
        email: formValues.email,
        phone: formValues.phone,
        bio: formValues.bio,
        affiliation: formValues.affiliation,
        certificateName: formValues.certificateName,
      });

      setStatus({ type: "success", message: "Profile berhasil diupdate." });
      closeModal();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal menyimpan profile.";
      setStatus({ type: "error", message });
    } finally {
      setSaving(false);
    }
  };

  const openModalWithReset = () => {
    setStatus(null);
    setFormValues({
      firstName,
      lastName,
      email,
      phone,
      bio,
      affiliation,
      certificateName,
    });
    openModal();
  };

  return (
    <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90 lg:mb-6">
            Personal Information
          </h4>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-7 2xl:gap-x-32">
            <div>
              <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
                First Name
              </p>
              <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                {firstName}
              </p>
            </div>

            <div>
              <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
                Last Name
              </p>
              <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                {lastName}
              </p>
            </div>

            <div>
              <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
                Email address
              </p>
              <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                {email}
              </p>
            </div>

            <div>
              <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
                Phone
              </p>
              <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                {phone}
              </p>
            </div>

            <div>
              <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
                Affiliation
              </p>
              <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                {affiliation}
              </p>
            </div>

            <div>
              <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
                Bio
              </p>
              <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                {bio}
              </p>
            </div>

            <div className="col-span-2 lg:col-span-1">
              <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
                Certificate Name
              </p>
              <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                {certificateName}
              </p>
              {certificateNote ? (
                <p className="mt-2 text-xs text-slate-500">{certificateNote}</p>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex items-start lg:items-center gap-3">
          <Button size="sm" variant="outline" type="button" onClick={openModalWithReset}>
            Edit
          </Button>
        </div>
      </div>

      {status ? (
        <p
          className={`mt-4 text-sm ${
            status.type === "success"
              ? "text-success-700 dark:text-success-300"
              : "text-error-600 dark:text-error-400"
          }`}
        >
          {status.message}
        </p>
      ) : null}

      <Modal isOpen={isOpen} onClose={closeModal} className="max-w-[700px] m-4">
        <div className="no-scrollbar relative w-full max-w-[700px] overflow-y-auto rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-11">
          <div className="px-2 pr-14">
            <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
              Edit Personal Information
            </h4>
            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400 lg:mb-7">
              Update your details to keep your profile up-to-date.
            </p>
          </div>
          <form className="flex flex-col" onSubmit={handleSave}>
            <div className="custom-scrollbar h-[450px] overflow-y-auto px-2 pb-3">
              <div>
                <h5 className="mb-5 text-lg font-medium text-gray-800 dark:text-white/90 lg:mb-6">
                  Personal Information
                </h5>

                <div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
                  <div className="col-span-2 lg:col-span-1">
                    <Label>First Name</Label>
                    <Input type="text" defaultValue={formValues.firstName} onChange={handleInputChange("firstName")} />
                  </div>

                  <div className="col-span-2 lg:col-span-1">
                    <Label>Last Name</Label>
                    <Input type="text" defaultValue={formValues.lastName} onChange={handleInputChange("lastName")} />
                  </div>

                  <div className="col-span-2 lg:col-span-1">
                    <Label>Email Address</Label>
                    <Input type="text" defaultValue={formValues.email} disabled />
                  </div>

                  <div className="col-span-2 lg:col-span-1">
                    <Label>Phone</Label>
                    <Input type="text" defaultValue={formValues.phone} onChange={handleInputChange("phone")} />
                  </div>

                  <div className="col-span-2 lg:col-span-1">
                    <Label>Affiliation</Label>
                    <Input type="text" defaultValue={formValues.affiliation} onChange={handleInputChange("affiliation")} />
                  </div>

                  <div className="col-span-2">
                    <Label>Bio</Label>
                    <Input type="text" defaultValue={formValues.bio} onChange={handleInputChange("bio")} />
                  </div>

                  <div className="col-span-2 lg:col-span-1">
                    <Label>Certificate Name</Label>
                    <Input type="text" defaultValue={formValues.certificateName} onChange={handleInputChange("certificateName")} />
                    <p className="mt-2 text-xs text-slate-500">Certificate name can be edited once per day.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 px-2 mt-6 lg:justify-end">
              <Button size="sm" variant="outline" type="button" onClick={closeModal}>
                Close
              </Button>
              <Button size="sm" type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
}
