"use client";

import UnitForm from "../../../_components/UnitForm";

import { use } from "react";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default function EditQuestionPage({
  params,
}: Props) {

  const { id } = use(params);

  return (
    <UnitForm
      mode="edit"
      unitId={id}
    />
  );
}