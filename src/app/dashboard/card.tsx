import React from "react";

interface Props {
  title: string;
  content: string;
}

const Card = ({ title, content }: Props) => {
  return (
    <div className="bg-gray-100 min-h-1/4 md:w-1/5 rounded-md p-4 duration-300 hover:rounded-xl">
      <span className="text-slate-600">{title}</span>
      <h1 className="font-bold text-3xl md:text-6xl mt-3">{content}</h1>
    </div>
  );
};

export default Card;
