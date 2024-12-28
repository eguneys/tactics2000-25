import Module from './assets/emc/hopefox.js'

export async function get_module() {
    let module = await Module()

    module._init()

    return function search_san(fen: string, rules: string) {
        let res = readStringFromMemory(module, module._search(writeStringToMemory(module, fen), writeStringToMemory(module, rules)))

        return res
    }
}

function writeStringToMemory(module: any, str: string) {
    const length = str.length + 1; // +1 for null terminator
    const ptr = module._malloc(length); // Allocate memory

    // Copy the string into WebAssembly memory
    for (let i = 0; i < str.length; i++) {
        module.HEAP8[ptr + i] = str.charCodeAt(i);
    }
    module.HEAP8[ptr + str.length] = 0; // Null-terminate the string

    return ptr; // Return the pointer to the string in memory
}

function readStringFromMemory(module: any, ptr: string) {
    let str = "";
    let offset = 0;
    let char;

    // Read characters from memory until null terminator (`\0`) is found
    while ((char = module.HEAP8[ptr + offset]) !== 0) {
        str += String.fromCharCode(char);
        offset++;
    }

    return str; // Return the JavaScript string
}
