import * as React from "react";
import { Toaster as Sonner } from "sonner";

function Toaster({ ...props }: React.ComponentProps<typeof Sonner>) {
  return (
    <Sonner
      position="top-right"
      closeButton
      expand
      icons={{
        success: (
          <>
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute -left-8 top-8 h-auto w-20 rotate-90 text-status-success-tint"
              viewBox="0 0 1440 320"
              fill="currentColor"
            >
              <path d="M0,256L11.4,240C22.9,224,46,192,69,192C91.4,192,114,224,137,234.7C160,245,183,235,206,213.3C228.6,192,251,160,274,149.3C297.1,139,320,149,343,181.3C365.7,213,389,267,411,282.7C434.3,299,457,277,480,250.7C502.9,224,526,192,549,181.3C571.4,171,594,181,617,208C640,235,663,277,686,256C708.6,235,731,149,754,122.7C777.1,96,800,128,823,165.3C845.7,203,869,245,891,224C914.3,203,937,117,960,112C982.9,107,1006,181,1029,197.3C1051.4,213,1074,171,1097,144C1120,117,1143,107,1166,133.3C1188.6,160,1211,224,1234,218.7C1257.1,213,1280,139,1303,133.3C1325.7,128,1349,192,1371,192C1394.3,192,1417,128,1429,96L1440,64L1440,320L1428.6,320C1417.1,320,1394,320,1371,320C1348.6,320,1326,320,1303,320C1280,320,1257,320,1234,320C1211.4,320,1189,320,1166,320C1142.9,320,1120,320,1097,320C1074.3,320,1051,320,1029,320C1005.7,320,983,320,960,320C937.1,320,914,320,891,320C868.6,320,846,320,823,320C800,320,777,320,754,320C731.4,320,709,320,686,320C662.9,320,640,320,617,320C594.3,320,571,320,549,320C525.7,320,503,320,480,320C457.1,320,434,320,411,320C388.6,320,366,320,343,320C320,320,297,320,274,320C251.4,320,229,320,206,320C182.9,320,160,320,137,320C114.3,320,91,320,69,320C45.7,320,23,320,11,320L0,320Z" />
            </svg>
            <svg aria-hidden="true" className="size-[17px]" viewBox="0 0 24 24" fill="none">
              <path
                d="m7 12.5 3.2 3.2L17.5 8"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.2"
              />
            </svg>
          </>
        ),
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "group relative isolate flex h-20 !w-[330px] max-w-[calc(100vw-2rem)] items-center gap-[15px] overflow-hidden rounded-lg bg-card px-[15px] py-2.5 pr-12 text-card-foreground shadow-lg",
          success:
            "text-card-foreground [&_[data-icon]]:rounded-full [&_[data-icon]]:bg-status-success-tint [&_[data-icon]]:text-status-success-tone [&_[data-title]]:text-status-success-tone",
          icon: "static ml-2 flex size-[35px] shrink-0 items-center justify-center",
          content: "flex min-w-0 flex-1 flex-col items-start justify-center gap-0",
          title: "cursor-default text-[17px] font-semibold leading-tight",
          description: "mt-0.5 cursor-default text-xs leading-normal text-muted-foreground",
          closeButton:
            "absolute right-[15px] top-1/2 flex size-[18px] -translate-y-1/2 items-center justify-center border-0 bg-transparent p-0 text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
        },
      }}
      {...props}
      richColors={false}
    />
  );
}

export { Toaster };
