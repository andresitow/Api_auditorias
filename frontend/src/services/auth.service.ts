import Cookies from "js-cookie";
import { api } from "./api";
import type { User } from "@/types";

export interface LoginResponse {
  accessToken: string;
  user: User;
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>("/auth/login", { username, password });
  Cookies.set("token", data.accessToken, { expires: 1, sameSite: "lax" });
  return data;
}

export function logout() {
  Cookies.remove("token");
  window.location.href = "/login";
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const { data } = await api.get<User>("/users/me");
    return data;
  } catch {
    return null;
  }
}
