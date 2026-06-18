extends Node
## Global signal bus so gameplay nodes stay loosely coupled.

# Combat / pickups
signal enemy_killed(score: int, world_pos: Vector2, beskar_amount: int, sparkly: bool)
signal beskar_collected(amount: int)
signal player_hit(hearts_left: int)
signal player_healed(hearts: float)
signal player_died()
signal player_revived()

# Run flow
signal run_started()
signal wave_started(index: int, total: int)
signal all_waves_cleared()
signal boss_spawned(boss_name: String)
signal boss_hp_changed(current: float, max: float)
signal boss_defeated()
signal level_complete()
signal run_over(victory: bool)

# Weapons / powers
signal weapon_changed(weapon_id: String)
signal force_power_ready()
signal force_power_used(cooldown: float)
signal force_power_cooldown(remaining: float, total: float)

# Score / vault (HUD)
signal score_changed(score: int)
signal run_beskar_changed(amount: int)
