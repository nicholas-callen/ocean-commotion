import {defs, tiny} from './examples/common.js';
import {Shape_From_File} from "./examples/obj-file-demo.js";

const {
    Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene, Component, Texture
} = tiny;

const {Cube, Subdivision_Sphere, Textured_Phong} = defs;

//Colors
const natural_ambient = 0.3;
const default_period = 30;
let wave_period = default_period;
const spawn_distance = 100;
const base_color = hex_color("#185b3b");
const danger_color = hex_color("#726329");
let body_color = base_color;
const wing_color = hex_color("#96ce86");
const light_color = hex_color("#75c1ff");
const sky_color = hex_color("#061d27");
const sky_height_offset = -10;

//Fish related Activities
//Fish moves vertically (Y- plane), and horizontally (Z- Plane)
const max_lives = 3;
let debris_amount = 300;

const NONE = 0;
const LEFT = 1;
const RIGHT = 2;
const UP = 3;
const DOWN = 4;
const horz_range = 9;
const vert_range = 6;
const depth_range = 20;

export class Game extends Scene {wd
    constructor() {
        super();
        this.shapes = {
            fish_body: new Shape_From_File("assets/fish_body.obj"),
            fish_wingL: new Shape_From_File("assets/fish_wingL.obj"),
            fish_wingR: new Shape_From_File("assets/fish_wingR.obj"),
            fish_mouth: new Shape_From_File("assets/fish_mouth.obj"),
            cube: new Cube(),
            eye: new Subdivision_Sphere(1),
            debris: new Shape_From_File("assets/debris.obj"),
            skull: new Shape_From_File("assets/skull.obj"),
        };

        //Texture and Material
        const textured = new defs.Textured_Phong(1);
        this.materials = {
            sky: new Material(textured, {
                ambient: 0.9,
                color: sky_color,
                texture: new Texture("assets/ocean.jpg"),
                diffusivity: 0,
                specularity: 0
            }),

            fish_body: new Material(textured, {
                ambient: natural_ambient,
                texture: new Texture("assets/chain.jpg"),
                color: body_color
            }),

            fish_wing: new Material(textured, {
                ambient: natural_ambient,
                texture: new Texture("assets/oaklog.png"),
                color: wing_color,
                diffusivity: 0.6,
                specularity: 0.3
            }),

            fish_eye: new Material(new defs.Phong_Shader(), {
                ambient: 0,
                diffusivity: 0.5,
                specularity: 1,
                color: hex_color("#000000")
            }),

            fish_mouth: new Material(new defs.Phong_Shader(), {
                ambient: natural_ambient,
                diffusivity: 0.5,
                specularity: 1,
                color: hex_color("#ffffff")
            }),

            floor: new Material(new Texture_Scroll_X(), {
                color: hex_color("#000000"),
                ambient: 0.9,
                diffusivity: 0,
                specularity: 0,
                texture: new Texture("assets/sand.jpg", "LINEAR_MIPMAP_LINEAR")
            }),

            roof: new Material(new Texture_Scroll_X(), {
                color: hex_color("#000000"),
                ambient: 0.9,
                diffusivity: 0,
                specularity: 0,
                texture: new Texture("assets/water_surface.jpeg", "LINEAR_MIPMAP_LINEAR")
            }),

            debris: new Material(new defs.Phong_Shader(), {
                color: hex_color("#a79595"),
                ambient: natural_ambient,
                diffusivity: 0.5,
                specularity: 0.5,
            }),

            skull: new Material(new defs.Phong_Shader(), {
               color: hex_color("#caca90"),
                ambient: natural_ambient,
                diffusivity: 0.8,
                specularity: 0.9,
            }),

            cross: new Material(new defs.Phong_Shader(), {
               color: hex_color("#ff0000"),
               ambient: 1,
               diffusivity: 0,
               specularity: 0,
            }),
        };

        this.floor_transform = Mat4.identity()
            .times(Mat4.translation(0, -10 + sky_height_offset, 0, 0))
            .times(Mat4.scale(150, 1, 200));

        this.roof_transform = Mat4.identity()
            .times(Mat4.translation(0, 70 + sky_height_offset, 0, 0))
            .times(Mat4.scale(-150, 1, 200));

        this.fish = new Fish(0, 0);
        this.ctrl_time = 0;
        this.can_control = false;

        this.debris = [];
        for(let i = 0; i < debris_amount; i++) {
            this.debris[i] = new Debris();
        }

        this.game_over = false;
        this.last_time = 0;
        this.fish_view = false;
        this.reboot = false;
    }

    make_control_panel() {
        //format of key triggered: (desc, key, function)
        this.key_triggered_button("Swim Up", ["w"], () => this.fish.move(UP * this.can_control, this.ctrl_time));
        this.key_triggered_button("Swim Left", ["a"], () => this.fish.move(LEFT * this.can_control, this.ctrl_time));
        this.key_triggered_button("Swim Down", ["s"], () => this.fish.move(DOWN * this.can_control, this.ctrl_time));
        this.key_triggered_button("Swim Right", ["d"], () => this.fish.move(RIGHT * this.can_control, this.ctrl_time));
        this.key_triggered_button("Reset Game", ["r"], () => this.reset());
        this.key_triggered_button("Toggle Fish View", ["f"], () => {this.fish_view = !this.fish_view})

    }
    display(context, program_state) {
        if(this.reboot) {
            program_state.animation_time = 0;
            program_state.animation_delta_time = 0;
            this.reboot = false;
            for (let i = 0; i < this.debris.length; i++) {
                this.debris[i].set_random(200);
            }
            this.fish.lives = max_lives;
        }

        const t = program_state.animation_time/1000 - this.last_time;
        if(!this.can_control && t > 5.5) {
            this.can_control = true;
        }

        let dt = program_state.animation_delta_time / 1000;
        this.ctrl_time = dt;
        let angle_sec = 2 * Math.PI * t;
        //Set up Camera Matrix, Projection Matrix, and Program_State
        //Centers camera on fish
        if(!this.game_over && !this.fish_view)
            program_state.set_camera(Mat4.look_at(
                vec3(Math.max(30 - t * 10, -20), 2 - 1.5 * this.fish.vert * dt, 1 / ((t * 0.001) ** 2 + 1)),
                vec3(0, this.fish.vert/2, this.fish.horz/3),
                vec3(0, 1, 0)));
        else
            program_state.set_camera(Mat4.look_at(
                vec3(8, this.fish.vert, 0),
                vec3(0, this.fish.vert, this.fish.horz),
                vec3(0, 1, 0)));


        //Projection Matrix
        program_state.projection_transform = Mat4.perspective(
            Math.PI/5, context.width / context.height, .1, 1000);
        let model_transform = Mat4.identity();
        //Simulate passing by stars
        //Oscillates between 0 and 1
        let light_position = vec4(
            Math.tan(angle_sec)/1000,
            //2 * Math.sin(angle_sec / 2),
            300,
            4 * Math.cos(angle_sec / 2),
            1);

        if(!this.game_over)
            program_state.lights = [new Light(light_position, light_color, 1000 ** 5)];
        else
            program_state.lights = [new Light(light_position, hex_color("#ff0000"), 1000 ** 5)];

        //Draw fish
        let fish_matrix = model_transform
            .times(Mat4.rotation( 0.15 * Math.sin(angle_sec),0, 1, 0))
            .times(Mat4.translation(0, this.fish.vert, this.fish.horz))
            .times(Mat4.rotation(this.fish.horz_tilt + 0.2 * Math.sin(angle_sec),1,0,0))
            .times(Mat4.rotation(this.fish.vert_tilt + 0.2 * Math.sin(t), 0, 0, 1));
        this.draw_fish(context, program_state, fish_matrix, dt)

        if(!this.game_over) {
            //Draw Active game environment
            if(t > 5)
                this.draw_crosshair(context, program_state);
            this.draw_sky(context, program_state, t)
            this.draw_debris(context, program_state, dt)
            this.shapes.cube.draw(context, program_state, this.floor_transform, this.materials.floor);
            this.shapes.cube.draw(context, program_state, this.roof_transform, this.materials.roof);
        }

        //rocks get get closer fast and faster
        wave_period = wave_period + dt;

        //Inverse of projection (gives screen space basically) // UI
        this.draw_ui(context, program_state, t, dt);
    }

    draw_ui(context, program_state, t, dt) {
        if(t < 5) return;
        if(!this.game_over && !this.fish_view && t > 0) {
            const screen_matrix = Mat4.inverse(Mat4.look_at(
                vec3(Math.max(30 - t * 10, -20), 2 - 1.5 * this.fish.vert * dt, 1 / ((t * 0.001) ** 2 + 1)),
                vec3(0, this.fish.vert/2, this.fish.horz/3),
                vec3(0, 1, 0)));

            //Show Lives
            for (let i = 0; i < this.fish.lives; i++) {
                let life_matrix = screen_matrix
                    .times(Mat4.translation(-1.5 + 0.3 * i, 0.75 + 0.05 * Math.sin(2 * Math.PI * t / 3 + i), -3))
                    .times(Mat4.rotation(-Math.PI / 2, 0, 1, 0))
                    .times(Mat4.scale(0.1, 0.1, 0.1));
                this.shapes.skull.draw(context, program_state, life_matrix, this.materials.skull);
            }
        }
        else {
            const screen_matrix = Mat4.inverse(Mat4.look_at(
                vec3(8, this.fish.vert, 0),
                vec3(0, this.fish.vert, this.fish.horz),
                vec3(0, 1, 0)));
            for (let i = 0; i < this.fish.lives; i++) {
                let life_matrix = screen_matrix
                    .times(Mat4.translation(-1.5 + 0.3 * i, 0.75 + 0.05 * Math.sin(2 * Math.PI * t / 3 + i), -3))
                    .times(Mat4.rotation(-Math.PI / 2, 0, 1, 0))
                    .times(Mat4.scale(0.1, 0.1, 0.1));
                this.shapes.skull.draw(context, program_state, life_matrix, this.materials.skull);
            }
        }
    }

    draw_fish(context, program_state, fish_matrix, t) {
        this.shapes.fish_body.draw(context, program_state, fish_matrix, this.materials.fish_body.override({color: body_color }));

        //Eye
        let eyeR_matrix = fish_matrix
            .times(Mat4.translation(1, 0.5, 0.4))
            .times(Mat4.scale(0.1, 0.1, 0.1));
        let eyeL_matrix = fish_matrix
            .times(Mat4.translation(1, 0.5, -0.4))
            .times(Mat4.scale(0.1, 0.1, 0.1));
        this.shapes.eye.draw(context, program_state, eyeR_matrix, this.materials.fish_eye);
        this.shapes.eye.draw(context, program_state, eyeL_matrix, this.materials.fish_eye);

        //Mouth
        let mouth_matrix =  fish_matrix
            .times(Mat4.translation(1.59, 0.1, 0))
            .times(Mat4.scale(0.3, 0.3, 0.3));
        this.shapes.fish_mouth.draw(context, program_state, mouth_matrix, this.materials.fish_mouth);

        //Wings
        this.draw_wings(context, program_state, fish_matrix, t);

        //Death Deco
        if(this.game_over)
            this.draw_death_scene(context, program_state, fish_matrix, t);
    }

    draw_wings(context, program_state, fish_matrix, t) {
        const half_fish_width = 0.85;
        const angle_sec =  2 * Math.PI * t;
        let oscilation = 0.5 - 0.5 * Math.cos(angle_sec);
        let max_wing_angle = (2 * Math.PI) * 0.05;
        let wing_off_angle = oscilation * max_wing_angle;

        let left_matrix = fish_matrix
            .times(Mat4.translation(0, 0, -half_fish_width))
            .times(Mat4.rotation(-wing_off_angle, 0, 1, 0));
        let right_matrix = fish_matrix
            .times(Mat4.translation(0, 0, half_fish_width))
            .times(Mat4.rotation(wing_off_angle, 0, 1, 0));
        this.shapes.fish_wingL.draw(context, program_state, left_matrix, this.materials.fish_wing);
        this.shapes.fish_wingL.draw(context, program_state, left_matrix, this.materials.fish_wing)
        this.shapes.fish_wingR.draw(context, program_state, right_matrix, this.materials.fish_wing);

        //Tail
        let tail_matrix = fish_matrix
            .times(Mat4.translation(-3, 0, 0))
            .times(Mat4.rotation(- 0.5 * Math.sin(angle_sec), 0, 1, 0))
            .times(Mat4.scale(1, 0.6, 0.6));
        let left_tail = tail_matrix
            .times(Mat4.rotation(1, 0, 1, 0))
            .times(Mat4.translation(0, 0, 0.5));
        let right_tail = tail_matrix
            .times(Mat4.rotation(-1, 0, 1, 0))
            .times(Mat4.translation(0, 0, -0.5));
        this.shapes.fish_wingL.draw(context, program_state, left_tail, this.materials.fish_wing);
        this.shapes.fish_wingR.draw(context, program_state, right_tail, this.materials.fish_wing);

    }

    draw_sky(context, program_state, t) {

        if (t >= 2.5) {
            let sky_matrix_front = Mat4.identity()
                .times(Mat4.translation(200, sky_height_offset, -20 * Math.sin(t * 2)))
                .times(Mat4.scale(0.1, 125, 400));
            this.shapes.cube.draw(context, program_state, sky_matrix_front, this.materials.sky);
        }

        //RENDER IN BEGINNING
        if(t < 4.5 || this.fish_view) {
            let sky_matrix_back = Mat4.identity()
                .times(Mat4.translation(-200, sky_height_offset, -20 * Math.sin(t / 1.4)))
                .times(Mat4.scale(0.1, 125, 400));

            this.shapes.cube.draw(context, program_state, sky_matrix_back, this.materials.sky);
        }

        if(this.fish.horz > 2) {
            let sky_matrix_right = Mat4.identity()
                .times(Mat4.translation(0, -10 + sky_height_offset, 200))
                .times(Mat4.scale(400, 125, 0.1));
            this.shapes.cube.draw(context, program_state, sky_matrix_right, this.materials.sky)
        }

        if(this.fish.horz < 2) {
            let sky_matrix_left = Mat4.identity()
                .times(Mat4.translation(0, -10 + sky_height_offset, -200))
                .times(Mat4.scale(400, 125, 0.1));
            this.shapes.cube.draw(context, program_state, sky_matrix_left, this.materials.sky);
        }
    }

    draw_debris(context, program_state, t) {
        const layer_matrix = Mat4.identity();
        const a_t = program_state.animation_time/1000;
        let has_inbound = false;
        for(let i = 0; i < debris_amount; i++) {
            const debris = this.debris[i];
            debris.depth = debris.depth - wave_period * t;
            debris.vert =
                (debris.vert +  0.1 * Math.sin(a_t * debris.bounce_offset)) * (1 - 0.08 * t);
            debris.horz =
                (debris.horz +  0.1 * Math.cos(a_t * debris.sway_offset)) * (1 - 0.08 * t);
            debris.tilt_x += t * debris.bounce_offset * debris.sway_offset;
            debris.tilt_y += 1.0005 * t * debris.bounce_offset;
            debris.tilt_z += 1.0005 * t * debris.sway_offset;


            //Reset piece of debris if beyond certain depth
            //Or if right on camera
            if(debris.depth < -100 ||
                (debris.depth < -10 && debris.horz > -2 && debris.horz < 2 && debris.vert > -1 && debris.vert < 1))
                debris.set_random(100);

            //Render Debris
            let debris_matrix = layer_matrix
                .times(Mat4.translation(debris.depth, debris.vert, debris.horz))
                .times(Mat4.rotation(debris.tilt_x, 1, 0, 0))
                .times(Mat4.rotation(debris.tilt_y, 0, 1, 0))
                .times(Mat4.rotation(debris.tilt_z, 0, 0, 1))
                .times(Mat4.scale(1, 1, 1));

            //Check if collided
            let incoming = this.fish.check_collision(debris);

            if(incoming) {
                has_inbound = true;
                if(debris.depth > -2 && debris.depth < 0 && program_state.animation_time/1000 > 5) {
                    this.fish.lives -= 1;
                    debris.set_random(100);
                }
                if(this.fish.lives <= 0)
                    this.game_over = true;
            }

            if(debris.type == 0)
                this.shapes.debris.draw(context, program_state, debris_matrix, this.materials.debris);
            else
                this.shapes.skull.draw(context, program_state, debris_matrix, this.materials.skull);
        }

        if(has_inbound) body_color = danger_color;
        else body_color = base_color;
    }

    draw_crosshair(context, program_state) {
        //Crosshair
        const cross_vert = Mat4.identity()
            .times(Mat4.translation(15, this.fish.vert, this.fish.horz))
            .times(Mat4.scale(0.1, 0.5, 0.1));
        const cross_horz = cross_vert
            .times(Mat4.scale(1, 0.2, 5));
        this.shapes.cube.draw(context, program_state, cross_vert, this.materials.cross)
        this.shapes.cube.draw(context, program_state, cross_horz, this.materials.cross)
    }

    draw_death_scene(context, program_state) {
        let t = program_state.animation_time/1000;
        const num_skull = 8;
        for (let i = 0; i < num_skull; i++) {
            //Inverse of projection matrix. Put in screen coordinates
            let skull_matrix = Mat4.inverse(Mat4.look_at(
                vec3(8, this.fish.vert, 0),
                vec3(0, this.fish.vert, this.fish.horz),
                vec3(0, 1, 0)))
                .times(Mat4.translation(3 * Math.cos(2 * Math.PI * i / num_skull + t),
                    3 * Math.sin(2 * Math.PI * i / num_skull + t), -8))
                .times(Mat4.rotation(-Math.PI/2, 0, 1, 0))
                .times(Mat4.scale(0.5, 0.5, 0.5));

            this.shapes.skull.draw(context, program_state, skull_matrix, this.materials.skull);
            let skull_eyes = skull_matrix
                .times(Mat4.translation(0, 0, 0));
            this.shapes.eye.draw(context, program_state, skull_eyes, this.materials.fish_eye.override(
                {color : hex_color("#ff6060"), ambient: 0.1}));
        }
    }

    reset(){
        //Reset Fish
        this.fish.vert = 0;
        this.fish.horz = 0;
        this.fish.horz_tilt = 0;
        this.fish.vert_tilt = 0;
        this.game_over = false;
        this.reboot = true;
        wave_period = default_period;
        this.x_layer_pos = spawn_distance;
    }
}


class Fish {
    constructor(horizontal, vertical) {
        this.vert = vertical;
        this.horz = horizontal;
        this.horz_tilt = 0;
        this.vert_tilt = 0;
        this.lives = max_lives;
    }

    move(direction = NONE, t) {
        if (NONE) return;
        const total_steps = 60 * t;
        const step_size = 0.001;
        const tilt_factor = 0.2;

        switch(direction) {
            case UP:
                for (let i = 0; i <= total_steps; i += step_size) {
                    this.vert = Math.min(vert_range, this.vert + step_size);
                }
                this.vert_tilt = tilt_factor;
                break;
            case DOWN:
                for (let i = 0; i <= total_steps; i+= step_size) {
                    this.vert = Math.max(-vert_range, this.vert - step_size);
                }
                this.vert_tilt = -tilt_factor;
                break;
            case LEFT:
                for (let i = 0; i <= total_steps; i+= step_size) {
                    this.horz = Math.max(-horz_range, this.horz - step_size);
                }
                this.horz_tilt = -tilt_factor;
                break;
            case RIGHT:
                for (let i = 0; i <= total_steps; i+= step_size) {
                    this.horz = Math.min(horz_range, this.horz + step_size);
                }
                this.horz_tilt = tilt_factor;
                break
            case NONE:
                this.horz_tilt = 0;
                this.vert_tilt = 0;
                break;
        }
    }

    check_collision(debris) {
        let incoming = false;

        const distance_to_center = Math.sqrt(
            (this.horz - debris.horz) ** 2 +
            (this.vert - debris.vert) ** 2
            );

        if(distance_to_center < 2 && debris.depth > -3 && debris.depth < 10) {
            incoming = true;
        }

        console.log(incoming);
        return incoming;
    }
}

class Debris {
    constructor() {
        this.horz = 0;
        this.vert = 0;
        this.depth = 0;
        this.tilt_x = 0;
        this.tilt_y = 0;
        this.tilt_z = 0;
        this.bounce_offset = 0;
        this.sway_offset = 0;
        this.set_random();
        //0 for mine, 1 for skull
        this.type = 0;
    }

    set_random(depth = 200) {
        const fill_multX = 8;
        const fill_multY = fill_multX * 6 / 9;
        const fill_multZ = 10;
        this.horz = -horz_range * fill_multX + 2 * fill_multX * horz_range * Math.random();
        this.vert = -vert_range * fill_multY * 0.25 +  1.75 * fill_multY * vert_range * Math.random() ;
        this.depth = depth + fill_multZ * depth_range * Math.random();
        this.bounce_offset = 2 * Math.random();
        this.sway_offset = 3 * Math.random();
        this.tilt_x = Math.random() * Math.PI;
        this.tilt_y = Math.random() * Math.PI;
        this.tilt_z = Math.random() * Math.PI;
        if(Math.random() > 0.90)
            this.type = 1;
        else
            this.type = 0;
    }

}

class Texture_Scroll_X extends Textured_Phong {
    fragment_glsl_code() {
        return this.shared_glsl_code() + `
            varying vec2 f_tex_coord;
            uniform sampler2D texture;
            uniform float animation_time;
            
            void main(){
                float slide_trans = mod(animation_time, 4.) * 0.20; 
                mat4 slide_matrix = mat4(vec4(-1.0, 0.0, 0.0, 0.0), 
                                   vec4( 0.0, 1.0, 0.0, 0.0), 
                                   vec4( 0.0, 0.0, 1.0, 0.0), 
                                   vec4(slide_trans, 0.0, 0.0, 1.0)); 

                vec4 new_tex_coord = vec4(f_tex_coord, 0, 0) + vec4(1., 1., 0., 1.); 
                new_tex_coord = slide_matrix * new_tex_coord; 

                vec4 tex_color = texture2D(texture, new_tex_coord.xy);

                if( tex_color.w < .01 ) discard;

                // Compute an initial (ambient) color:
                gl_FragColor = vec4( ( tex_color.xyz + shape_color.xyz ) * ambient, shape_color.w * tex_color.w ); 

                // Compute the final color with contributions from lights:
                gl_FragColor.xyz += phong_model_lights( normalize( N ), vertex_worldspace );
        } `;
    }
}