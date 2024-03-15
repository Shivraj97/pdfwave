import { useMutation } from "@tanstack/react-query";
import { createContext, useState, useRef } from "react";
import { trpc } from "../../app/_trpc/client";
import { INFINITE_QUERY_LIMIT } from "../../config/infinite-query";
import { useToast } from "../ui/use-toast";

type StreamResponse = {
  addMessage: () => void;
  message: string;
  handleInputChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  isLoading: boolean;
};

export const ChatContext = createContext<StreamResponse>({
  addMessage: () => {},
  message: "",
  handleInputChange: () => {},
  isLoading: false,
});

interface Props {
  fileId: string;
  children: React.ReactNode;
}
export const ChatContextProvider = ({ fileId, children }: Props) => {
  const [message, setMessage] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const backupMessage = useRef<string>("");
  const utils = trpc.useContext();
  const { toast } = useToast();

  const { mutate: sendMessage } = useMutation({
    mutationFn: async ({ message }: { message: string }) => {
      const response = await fetch(`/api/message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fileId, message }),
      });
      if (!response.ok) {
        throw new Error(response.statusText || "Failed to send message");
      }
      return response.body;
    },
    onMutate: async () => {
      backupMessage.current = message;
      setMessage("");

      // step 1
      // Cancel any outgoing refetches
      // (so they don't overwrite our optimistic update)
      await utils.getFileMessages.cancel();

      // step 2
      // Snapshot the previous value
      const previousMessages = utils.getFileMessages.getInfiniteData();

      // step 3
      // Optimistically update to the new value
      utils.getFileMessages.setInfiniteData(
        {
          fileId,
          limit: INFINITE_QUERY_LIMIT,
        },
        (old) => {
          if (!old) {
            return {
              pages: [],
              pageParams: [],
            };
          }

          let newPages = [...old.pages];

          let latestPage = newPages[0];

          latestPage.messages = [
            {
              createdAt: new Date().toISOString(),
              id: crypto.randomUUID(),
              text: message,
              isUserMessage: true,
            },
            ...latestPage.messages,
          ];

          newPages[0] = latestPage;

          return {
            ...old,
            pages: newPages,
          };
        }
      );
      setIsLoading(true);

      // Return a context object with the snapshotted value
      return {
        previousMessages:
          previousMessages?.pages?.flatMap((page) => page.messages) ?? [],
      };
    },
    onSuccess: async (stream) => {
      setIsLoading(false);

      if (!stream) {
        return toast({
          title: "There was a problem sending this message",
          description: "Please refresh this page and try again",
          variant: "destructive",
        });
      }

      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let done = false;

      // accumulated response
      let accResponse = "";

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        const chunkValue = decoder.decode(value);
        accResponse += chunkValue;

        // append chunk to the actual message
        utils.getFileMessages.setInfiniteData(
          { fileId, limit: INFINITE_QUERY_LIMIT },
          (old) => {
            if (!old)
              return {
                pages: [],
                pageParams: [],
              };
            let isAiResponseCreated = old.pages.some((page) =>
              page.messages.some((message) => message.id === "ai-response")
            );

            let updatedPages = old.pages.map((page) => {
              if (page === old.pages[0]) {
                let updatedMessages;

                if (!isAiResponseCreated) {
                  updatedMessages = [
                    {
                      createdAt: new Date().toISOString(),
                      id: "ai-response",
                      text: accResponse,
                      isUserMessage: false,
                    },
                    ...page.messages,
                  ];
                } else {
                  updatedMessages = page.messages.map((message) => {
                    if (message.id === "ai-response") {
                      return {
                        ...message,
                        text: accResponse,
                      };
                    }
                    return message;
                  });
                }
                return {
                  ...page,
                  messages: updatedMessages,
                };
              }
              return page;
            });
          }
        );
      }
    },
    // If the mutation fails,
    // use the context returned from onMutate to roll back
    onError: async (_, __, context) => {
      setMessage(backupMessage.current);
      utils.getFileMessages.setData(
        { fileId },
        { messages: context?.previousMessages ?? [] }
      );
    },
    // Always refetch after error or success:
    onSettled: async () => {
      setIsLoading(false);
      await utils.getFileMessages.invalidate({ fileId });
    },
  });

  const addMessage = () => {
    sendMessage({ message });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
  };

  return (
    <ChatContext.Provider
      value={{
        addMessage,
        message,
        handleInputChange,
        isLoading,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};
