"use client";

import { useForm } from "react-hook-form";
import { createChannel } from "@/services/channels.service";

interface FormValues {
  nombre: string;
  host: string;
}

export function AddChannelForm() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<FormValues>();

  const onSubmit = handleSubmit(async ({ nombre, host }) => {
    await createChannel(nombre.trim().toUpperCase(), host.trim());
    reset();
  });

  return (
    <form onSubmit={onSubmit} className="bg-bg2 border border-border rounded-lg px-4 py-3 flex gap-2.5 items-center flex-wrap mb-5">
      <input
        placeholder="Nombre (ej: ETB)"
        maxLength={20}
        className="w-[130px] bg-bg3 border border-border text-text rounded-md px-2.5 h-[34px] text-[13px] outline-none focus:border-blue"
        {...register("nombre", { required: true, maxLength: 20 })}
      />
      <input
        placeholder="Host o IP (ej: 8.8.8.8)"
        maxLength={120}
        className="w-[220px] bg-bg3 border border-border text-text rounded-md px-2.5 h-[34px] text-[13px] outline-none focus:border-blue"
        {...register("host", { required: true, maxLength: 120 })}
      />
      <button
        type="submit"
        disabled={isSubmitting}
        className="h-[34px] px-3.5 rounded-md border border-[#2ea043] bg-[#1a3a2a] text-green text-[13px] hover:bg-[#1f4a33] disabled:opacity-60"
      >
        + Agregar canal
      </button>
    </form>
  );
}
