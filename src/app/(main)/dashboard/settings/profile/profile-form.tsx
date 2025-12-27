"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { api } from "@/trpc/react";

import type { RouterOutputs } from "@/trpc/shared";

const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(255, "Name is too long"),
});

type ProfileFormProps = {
  userProfile: RouterOutputs["user"]["getProfile"];
};

export function ProfileForm({ userProfile }: ProfileFormProps) {
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: userProfile?.name ?? "",
    },
  });

  const { mutate: updateProfile } = api.user.updateProfile.useMutation({
    onSuccess: () => {
      setIsSaving(false);
      toast.success("Profile updated successfully");
    },
    onError: (error) => {
      setIsSaving(false);
      toast.error(error.message);
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSaving(true);
    updateProfile(values);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Information</CardTitle>
        <CardDescription>
          Update your personal information.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter your name" {...field} />
                  </FormControl>
                  <FormDescription>
                    This is the name that will be displayed on your profile.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="text-sm text-muted-foreground">
              <span className="font-medium">Email:</span>{" "}
              {userProfile?.email ?? "Not available"}
            </div>
            <Button
              type="submit"
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
