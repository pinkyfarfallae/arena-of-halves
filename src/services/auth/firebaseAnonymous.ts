import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updatePassword, User } from "firebase/auth";
import { auth } from "../../firebase";

export const email = (characterId: string) => `${characterId}@arenaofhalves.th`;

export const registerCharacter = async (characterId: string, password: string): Promise<User | null> => {
  const emailAddress = email(characterId);
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, emailAddress, password);
    return userCredential.user;
  } catch (error: any) {
    if (error.code === "auth/email-already-in-use") {
      return loginCharacter(characterId, password);
    } else {
      return null;
    }
  }
};

export const loginCharacter = async (characterId: string, password: string): Promise<User | null> => {
  const emailAddress = email(characterId);
  try {
    const userCredential = await signInWithEmailAndPassword(auth, emailAddress, password);
    return userCredential.user;
  } catch (error: any) {
    return null;
  }
};

export const changePassword = async (newPassword: string): Promise<boolean> => {
  const user = auth.currentUser;
  if (!user) {
    console.error("No user is currently signed in");
    return false;
  }
  
  try {
    await updatePassword(user, newPassword);
    return true;
  } catch (error: any) {
    console.error("Password change failed:", error.message);
    return false;
  }
};