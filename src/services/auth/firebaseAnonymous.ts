import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updatePassword, User } from "firebase/auth";
import { auth } from "../../firebase";

export const email = (characterId: string) => `${characterId}@arenaofhalves.th`;

export const registerCharacter = async (characterId: string, password: string): Promise<User | null> => {
  const emailAddress = email(characterId);
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, emailAddress, password);
    console.log("Character registered UID:", userCredential.user.uid);
    return userCredential.user;
  } catch (error: any) {
    if (error.code === "auth/email-already-in-use") {
      return loginCharacter(characterId, password);
    } else {
      console.error("Register failed:", error.message);
      return null;
    }
  }
};

export const loginCharacter = async (characterId: string, password: string): Promise<User | null> => {
  const emailAddress = email(characterId);
  try {
    const userCredential = await signInWithEmailAndPassword(auth, emailAddress, password);
    console.log("Character logged in UID:", userCredential.user.uid);
    return userCredential.user;
  } catch (error: any) {
    console.error("Login failed:", error.message);
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
    console.log("Password updated successfully");
    return true;
  } catch (error: any) {
    console.error("Password change failed:", error.message);
    return false;
  }
};