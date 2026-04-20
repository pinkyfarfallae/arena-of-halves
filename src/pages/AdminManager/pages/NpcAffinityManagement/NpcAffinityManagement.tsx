import React, { useEffect, useState } from "react";
import { useAuth } from "../../../../hooks/useAuth";
import './NpcAffinityManagement.scss';
import { Character } from "../../../../types/character";
import { fetchAllCharacters } from "../../../../data/characters";
import { fetchNPCs } from "../../../../data/npcs";


export default function NpcAffinityManagement() {
  const { user } = useAuth();

  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [loading, setLoading] = useState(true);

  const [allPlayers, setAllPlayers] = useState<Character[]>([]);
  const [players, setPlayers] = useState<Character[]>([]);

  const [allNpcs, setAllNpcs] = useState<Character[]>([]);
  const [npcs, setNpcs] = useState<Character[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      const [fetchedPlayers, fetchedNpcs] = await Promise.all([
        fetchAllCharacters(),
        fetchNPCs(),
      ]);

      setAllPlayers(fetchedPlayers);
      setPlayers(fetchedPlayers);

      console.log(fetchedNpcs);

      setLoading(false);
    };

    fetchData();
  }, [user?.characterId]);

  return (
    <div className="npc-affinity-management">
      <h1>NPC Affinity Management</h1>
      <p>This page is under construction. Please check back later.</p>
    </div>
  );
}