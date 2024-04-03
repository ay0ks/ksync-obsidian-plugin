import axios from "axios";
import { TAbstractFile, TFolder, Vault } from "obsidian"
import KSyncPlugin from "src/main";
import { hash } from "src/util/FileUtil";

export class VaultService {
    public tempBasePath = '.ksync';
    public vault: Vault;
    public plugin: KSyncPlugin;

    constructor(plugin: KSyncPlugin) {
        this.vault = plugin.app.vault;
        this.plugin = plugin;
        this.checkTemp();
    }

    async sync() {
        const metadata = await this.getMetadata();
        const id = this.plugin.settings.vaultid;
        const data = (await this.plugin.api.axios.post(`/vault/${id}/sync`,{ metadata }, {
            headers: { Authorization: this.plugin.settings.token },
        })).data

        console.log(data)

        data.toDownload.forEach((file: any) => {
            this.Download(file.path, file.link, file.ctime, file.mtime);
        })

        data.toUpload.forEach((file: any) => {
            this.Upload(file.path, file.link);
        })

        return 0
    }

    private async checkTemp() {
        const temp = await this.vault.adapter.exists(this.tempBasePath);

        if(!temp) {
            console.log("No temp folder");
            await this.vault.createFolder(this.tempBasePath)
            return console.log("Created");
        }
        console.log("Temp Folder Exists!");
    }

    async getMetadata() {
        const snapshot = Array<IFile>();
        const files = this.vault.getFiles();
        for (const file of files) {
            let hashed = await hash(await this.vault.read(file))
            snapshot.push({
                path: file.path,
                size: file.stat.size,
                hash: hashed,
                ctime: file.stat.ctime,
                mtime: file.stat.mtime,
                deleted: false
            });
        }
        
        return snapshot
    }

    async SaveToFile() {
        let files = await this.getMetadata();
        this.vault.adapter.write(this.tempBasePath+'/metadata.json', JSON.stringify(files))
    }

    async getSize() {
        const files = await this.plugin.manager.getMetadata();
        return files.reduce((accumulator, currentFile) => {return accumulator + currentFile.size}, 0);
    }


    onDelete(file: TAbstractFile) {
        console.log("File deleted");
        this.vault.adapter.copy(file.path, this.tempBasePath + file.path);
    }

    async Upload(path: string, link: string) {
        const file = await this.vault.adapter.readBinary(path)
        const data = (await axios.put(link, file)).data
        console.log(data);
        return data
    }

    async Download(path: string, link: string, ctime: number, mtime: number) {
        const data = (await axios.get(link, {responseType: "blob"})).data;
        ctime = Number(ctime);
        mtime = Number(mtime);
        const blob = new Blob([data])
        const buffer = await blob.arrayBuffer();
        if(this.vault.getAbstractFileByPath(path)) {
            this.vault.adapter.writeBinary(path, buffer, {ctime, mtime})
        } else {
            this.checkFolder(path);
            this.vault.createBinary(path, buffer, {
                ctime, mtime
            });
        }
        
        return 1
    }

    async checkFolder(path: string) {
        const elements = path.split("/");
        elements.pop();
        let dir = "";
        for (const folder of elements) {
            dir += folder;
            try {
                await this.vault.adapter.mkdir(dir);
            } catch (ex: any) {}
            dir += "/";
        }
    }

}


interface IFile {
    path: string;
    size: number;
    hash: string;
    ctime: number;
    mtime: number;
    deleted: boolean;
}