"use client";

import UnitDetail from "../../_components/UnitDetail";

import { use } from "react";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default function ViewUnitPage({
  params,
}: Props) {

  const { id } = use(params);

  return (
    <UnitDetail unitId={id} />
  );
}