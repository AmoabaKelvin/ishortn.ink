"use client";

import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Inputs = {
  url: string;
};

const QuickLinkShorteningForm = () => {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Inputs>();

  const onSubmit = (data: Inputs) => {
    console.log(data);
  };

  return (
    <div className="rounded-md bg-gray-100/65 p-6">
      <h1 className="text-xl font-semibold leading-tight text-gray-800">Quick Shorten</h1>
      <p className="text-sm text-gray-500">Shorten a link quickly without any settings</p>
      <Input
        type="url"
        placeholder="Paste a link to shorten"
        className={cn(
          "mt-4 w-full",
          errors.url && "border-red-500 placeholder:text-red-500 dark:border-red-400",
        )}
        {...register("url", { required: true })}
      />
      <Button className="mt-4 w-full" onClick={handleSubmit(onSubmit)}>
        Shorten
      </Button>
    </div>
  );
};

export { QuickLinkShorteningForm };
