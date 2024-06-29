"use client";
import Link from "next/link";
import React, { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

type FeaturesProps = {
  name: string;
  description: string;
  logo: React.ReactNode;
};

const CardSpotlight = (props: FeaturesProps) => {
  const divRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!divRef.current || isFocused) return;

    const div = divRef.current;
    const rect = div.getBoundingClientRect();

    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleFocus = () => {
    setIsFocused(true);
    setOpacity(1);
  };

  const handleBlur = () => {
    setIsFocused(false);
    setOpacity(0);
  };

  const handleMouseEnter = () => {
    setOpacity(1);
  };

  const handleMouseLeave = () => {
    setOpacity(0);
  };

  return (
    <Card
      ref={divRef}
      onMouseMove={handleMouseMove}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="relative overflow-hidden rounded-xl border bg-white dark:border-gray-800 dark:bg-gradient-to-r dark:from-black dark:to-neutral-950 dark:shadow-2xl"
    >
      <div
        className="pointer-events-none absolute -inset-px opacity-0 transition duration-300"
        style={{
          opacity,
          background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, rgba(255,182,255,.1), transparent 40%)`,
        }}
      />
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center gap-2 text-lg">
          {props.logo} {props.name}
        </CardTitle>
        <CardDescription className="pt-6 leading-7 text-black/70">
          {props.description}
        </CardDescription>

        <CardFooter className="w-full p-0">
          <Button className="mt-6 w-full" size="sm" variant="secondary" asChild>
            <Link href="/dashboard">Learn More</Link>
          </Button>
        </CardFooter>
      </CardHeader>
    </Card>
  );
};

export default CardSpotlight;
