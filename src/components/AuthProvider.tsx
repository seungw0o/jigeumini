"use client";

import { onAuthStateChanged, signInAnonymously, type User } from "firebase/auth";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getFirebaseAuth } from "@/apis/firebase/client";

type AuthState =
  | { status: "loading"; user: null }
  | { status: "signedIn"; user: User }
  | { status: "error"; user: null; error: Error };

const AuthContext = createContext<AuthState>({ status: "loading", user: null });

// 첫 방문부터 익명 계정으로 uid를 확보한다 (구글 로그인은 나중에 linkWithCredential로 같은 uid에 연결)
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading", user: null });

  useEffect(() => {
    const auth = getFirebaseAuth();
    return onAuthStateChanged(auth, (user) => {
      if (user) {
        setState({ status: "signedIn", user });
        return;
      }
      // 저장된 세션이 없을 때만 새 익명 계정을 만든다. 성공하면 위 콜백이 다시 불린다.
      signInAnonymously(auth).catch((error: unknown) => {
        setState({
          status: "error",
          user: null,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      });
    });
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
